// REST API used by the mobile app.
// Auth for the MVP: the app generates a random user id on first launch and sends it as `X-User-Id`.
// TODO before launch: replace with phone number + SMS code login.
import express, { Router, type Request } from "express";
import { config } from "./config.ts";
import { db, q, type Session, type Station } from "./db.ts";
import { charging } from "./charging.ts";
import { isOnline } from "./ocpp.ts";
import { markPaid } from "./idram.ts";
import { deleteCard, payOrderWithCard, startCardLink } from "./card.ts";

export const api = Router();
api.use(express.json());

const userId = (req: Request) => {
  const id = String(req.header("x-user-id") ?? "");
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw Object.assign(new Error("no_user"), { status: 401 });
  return id;
};

const sessionView = (s: Session) => ({
  id: s.id,
  stationId: s.station_id,
  stationName: q.station(s.station_id)?.name ?? s.station_id,
  connectorId: s.connector_id,
  status: s.status,
  budget: s.budget,
  pricePerKwh: s.price_per_kwh,
  energyKwh: s.energy_wh / 1000,
  powerKw: s.power_w / 1000,
  cost: s.cost,
  stopReason: s.stop_reason,
  error: s.error,
  createdAt: s.created_at,
  startedAt: s.started_at,
  stoppedAt: s.stopped_at,
});

api.get("/me", (req, res) => {
  const u = q.ensureUser(userId(req));
  res.json({
    id: u.id,
    balance: u.balance,
    active: q.activeSessionsForUser(u.id).map(sessionView),
  });
});

api.get("/me/cards", (req, res) => {
  res.json(q.cardsForUser(userId(req)).map((c) => ({ id: c.id, maskedPan: c.masked_pan, expiry: c.expiry })));
});

/** Start linking a card. The app opens formUrl (bank page) in a WebView and waits for /card/done. */
api.post("/me/cards", async (req, res) => {
  try {
    res.json(await startCardLink(userId(req)));
  } catch (e) {
    res.status(502).json({ error: "gateway_error", detail: (e as Error).message });
  }
});

api.get("/me/cards/:id", (req, res) => {
  const c = q.card(req.params.id);
  if (!c || c.user_id !== userId(req)) return res.status(404).json({ error: "not_found" });
  res.json({ id: c.id, status: c.status, maskedPan: c.masked_pan });
});

api.delete("/me/cards/:id", async (req, res) => {
  const c = q.card(req.params.id);
  if (!c || c.user_id !== userId(req)) return res.status(404).json({ error: "not_found" });
  await deleteCard(c);
  res.json({ ok: true });
});

api.get("/me/sessions", (req, res) => {
  res.json(q.sessionsForUser(userId(req)).map(sessionView));
});

const connectorsView = (stationId: string) =>
  q.connectors(stationId).map((c) => ({
    id: c.connector_id,
    type: c.type,
    maxKw: c.max_kw,
    status: c.status,
    busy: !!q.activeSessionOnConnector(stationId, c.connector_id),
  }));

const stationView = (st: Station) => {
  const connectors = connectorsView(st.id);
  const online = isOnline(st.id);
  return {
    id: st.id,
    name: st.name,
    address: st.address,
    lat: st.lat,
    lng: st.lng,
    pricePerKwh: st.price_per_kwh,
    online,
    freeConnectors: online ? connectors.filter((c) => c.status === "Available" && !c.busy).length : 0,
    minAmount: config.billing.minAmount,
    maxAmount: config.billing.maxAmount,
    connectors,
  };
};

// All stations, for the map
api.get("/stations", (_req, res) => {
  res.json(q.stations().map(stationView));
});

// QR codes on the station contain  hovo://station/<stationId>?connector=<n>
// (or just the station id). The app parses it and calls this endpoint.
api.get("/stations/:id", (req, res) => {
  const st = q.station(req.params.id);
  if (!st) return res.status(404).json({ error: "station_not_found" });
  res.json(stationView(st));
});

/** Create an order. If the balance covers it, charging starts right away; otherwise the app opens payUrl. */
api.post("/orders", async (req, res) => {
  const uid = userId(req);
  const user = q.ensureUser(uid);
  const { stationId, connectorId, amount, method = "idram", cardId } = req.body ?? {};
  if (method !== "idram" && method !== "card") return res.status(400).json({ error: "bad_method" });
  const card = method === "card" ? q.card(String(cardId)) : undefined;
  if (method === "card" && (!card || card.user_id !== uid || card.status !== "active"))
    return res.status(400).json({ error: "card_not_found" });
  const st = q.station(String(stationId));
  const total = Math.round(Number(amount));
  if (!st) return res.status(404).json({ error: "station_not_found" });
  if (!q.connector(st.id, Number(connectorId))) return res.status(400).json({ error: "connector_not_found" });
  if (!(total >= config.billing.minAmount && total <= config.billing.maxAmount))
    return res.status(400).json({ error: "bad_amount" });
  if (!isOnline(st.id)) return res.status(409).json({ error: "station_offline" });
  if (q.activeSessionOnConnector(st.id, Number(connectorId))) return res.status(409).json({ error: "connector_busy" });

  const fromBalance = Math.min(user.balance, total);
  const toPay = total - fromBalance;
  const info = db
    .prepare("INSERT INTO orders (user_id, station_id, connector_id, amount, from_balance, method, card_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(uid, st.id, Number(connectorId), toPay, fromBalance, toPay === 0 ? "balance" : method, card?.id ?? null);
  const orderId = Number(info.lastInsertRowid);
  if (fromBalance > 0) db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(fromBalance, uid);

  if (toPay === 0) {
    await markPaid(orderId, null, "balance");
    const order = q.order(orderId)!;
    return res.json({ orderId, paid: true, sessionId: order.session_id });
  }
  if (method === "card") {
    try {
      const r = await payOrderWithCard(orderId, card!.id, req.ip ?? "127.0.0.1");
      if (r.paid) {
        await markPaid(orderId, q.order(orderId)!.gateway_order_id, "card");
        return res.json({ orderId, paid: true, sessionId: q.order(orderId)!.session_id });
      }
      return res.json({ orderId, paid: false, amount: toPay, fromBalance, payUrl: r.payUrl });
    } catch (e) {
      // give the balance part back
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(fromBalance, uid);
      db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(orderId);
      return res.status(502).json({ error: "gateway_error" });
    }
  }
  res.json({ orderId, paid: false, amount: toPay, fromBalance, payUrl: `${config.publicUrl}/pay/${orderId}` });
});

api.get("/orders/:id", (req, res) => {
  const o = q.order(Number(req.params.id));
  if (!o || o.user_id !== userId(req)) return res.status(404).json({ error: "not_found" });
  res.json({ id: o.id, status: o.status, sessionId: o.session_id });
});

api.get("/sessions/:id", (req, res) => {
  const s = q.session(req.params.id);
  if (!s || s.user_id !== userId(req)) return res.status(404).json({ error: "not_found" });
  res.json(sessionView(s));
});

api.post("/sessions/:id/stop", async (req, res) => {
  const s = q.session(req.params.id);
  if (!s || s.user_id !== userId(req)) return res.status(404).json({ error: "not_found" });
  try {
    res.json(sessionView(await charging.stop(s.id)));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

api.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.status ?? 500).json({ error: err.message ?? "error" });
});
