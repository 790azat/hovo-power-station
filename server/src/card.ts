// Bank card payments + saved cards ("bindings") through an RBS-type gateway.
// ArCa iPay (ipay.arca.am) uses this API, and most Armenian acquiring banks connect merchants through it.
//
// Linking a card:  register.do (small verify amount, clientId=userId) -> user enters card on the bank page
//                  -> returnUrl -> getOrderStatusExtended.do gives bindingId + masked PAN -> reverse.do the verify amount
// Paying:          register.do -> paymentOrderBinding.do with the saved bindingId (no card entry)
//                  -> if the bank asks for 3-D Secure, the app opens the bank page instead.
//
// NOTE: check method names / fields against the API document your acquiring bank gives you.
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { config } from "./config.ts";
import { db, q, newId } from "./db.ts";

type GwStatus = { paid: boolean; bindingId?: string; maskedPan?: string; expiry?: string };
type Gateway = {
  register(p: { orderNumber: string; amount: number; description: string; clientId: string; returnUrl: string }): Promise<{ gwOrderId: string; formUrl: string }>;
  status(gwOrderId: string): Promise<GwStatus>;
  payWithBinding(gwOrderId: string, bindingId: string, ip: string): Promise<boolean>;
  reverse(gwOrderId: string): Promise<void>;
  unbind(bindingId: string): Promise<void>;
};

// ---------- Real RBS gateway ----------
async function rbs(method: string, params: Record<string, string>) {
  const body = new URLSearchParams({ userName: config.card.username, password: config.card.password, ...params });
  const res = await fetch(`${config.card.gatewayUrl}/${method}`, { method: "POST", body });
  const json = (await res.json()) as any;
  if (json.errorCode && json.errorCode !== "0" && json.errorCode !== 0) {
    throw new Error(`${method}: ${json.errorCode} ${json.errorMessage ?? ""}`);
  }
  return json;
}

const rbsGateway: Gateway = {
  async register(p) {
    const r = await rbs("register.do", {
      orderNumber: p.orderNumber,
      amount: String(p.amount * 100), // minor units
      currency: config.card.currency,
      returnUrl: p.returnUrl,
      failUrl: p.returnUrl,
      description: p.description,
      clientId: p.clientId,
      language: "hy",
      pageView: "MOBILE",
    });
    return { gwOrderId: r.orderId, formUrl: r.formUrl };
  },
  async status(gwOrderId) {
    const r = await rbs("getOrderStatusExtended.do", { orderId: gwOrderId });
    return {
      paid: r.orderStatus === 1 || r.orderStatus === 2,
      bindingId: r.bindingInfo?.bindingId,
      maskedPan: r.cardAuthInfo?.maskedPan ?? r.cardAuthInfo?.pan,
      expiry: r.cardAuthInfo?.expiration,
    };
  },
  async payWithBinding(gwOrderId, bindingId, ip) {
    const r = await rbs("paymentOrderBinding.do", { mdOrder: gwOrderId, bindingId, ip });
    if (r.acsUrl) return false; // 3-D Secure needed -> user must finish on bank page
    return (await rbsGateway.status(gwOrderId)).paid;
  },
  async reverse(gwOrderId) {
    await rbs("reverse.do", { orderId: gwOrderId });
  },
  async unbind(bindingId) {
    await rbs("unBindCard.do", { bindingId });
  },
};

// ---------- Mock gateway for development ----------
const mockOrders = new Map<string, { amount: number; description: string; returnUrl: string; status: GwStatus }>();
const mockGateway: Gateway = {
  async register(p) {
    const gwOrderId = "mock-" + randomUUID();
    mockOrders.set(gwOrderId, { amount: p.amount, description: p.description, returnUrl: p.returnUrl, status: { paid: false } });
    return { gwOrderId, formUrl: `${config.publicUrl}/card/mock-form/${gwOrderId}` };
  },
  async status(id) {
    return mockOrders.get(id)?.status ?? { paid: false };
  },
  async payWithBinding(id, bindingId) {
    const o = mockOrders.get(id);
    if (!o) return false;
    o.status = { paid: true, bindingId };
    return true;
  },
  async reverse() {},
  async unbind() {},
};

export const gateway: Gateway = config.card.mock ? mockGateway : rbsGateway;

// ---------- Business logic ----------
const returnUrl = () => `${config.publicUrl}/card/return`;

export async function startCardLink(userId: string) {
  q.ensureUser(userId);
  const id = newId();
  const r = await gateway.register({
    orderNumber: "B" + id.replace(/-/g, "").slice(0, 20),
    amount: config.card.verifyAmount,
    description: "Hovo Power: card verification",
    clientId: userId,
    returnUrl: returnUrl(),
  });
  db.prepare("INSERT INTO cards (id, user_id, gateway_order_id) VALUES (?, ?, ?)").run(id, userId, r.gwOrderId);
  return { cardId: id, formUrl: r.formUrl };
}

/** Pays an order with a saved card. Returns true if paid; false means the app must open payUrl (3-D Secure). */
export async function payOrderWithCard(orderId: number, cardId: string, ip: string): Promise<{ paid: boolean; payUrl?: string }> {
  const order = q.order(orderId)!;
  const card = q.card(cardId)!;
  const r = await gateway.register({
    orderNumber: "O" + order.id,
    amount: order.amount,
    description: `Hovo Power Station: ${order.station_id} #${order.connector_id}`,
    clientId: order.user_id,
    returnUrl: returnUrl(),
  });
  db.prepare("UPDATE orders SET gateway_order_id = ? WHERE id = ?").run(r.gwOrderId, order.id);
  const ok = await gateway.payWithBinding(r.gwOrderId, card.binding_id!, ip).catch((e) => {
    console.warn("[card] binding payment failed", e.message);
    return false;
  });
  return ok ? { paid: true } : { paid: false, payUrl: r.formUrl };
}

export async function deleteCard(card: { id: string; binding_id: string | null }) {
  if (card.binding_id) await gateway.unbind(card.binding_id).catch((e) => console.warn("[card] unbind", e.message));
  db.prepare("UPDATE cards SET status = 'deleted' WHERE id = ?").run(card.id);
}

// ---------- Web pages the app opens in a WebView ----------
export function cardRouter(markPaid: (orderId: number, transId: string | null, payer: string | null) => Promise<void>) {
  const r = Router();
  r.use(express.urlencoded({ extended: false }));

  const done = (ok: boolean) =>
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;text-align:center;padding-top:30vh">` +
    `<h2>${ok ? "✅" : "❌"}</h2><script>setTimeout(function(){location.href='/'},1500)</script></body>`;

  // Bank redirects here after card entry (both for linking and for paying)
  r.get("/card/return", async (req, res) => {
    const gwOrderId = String(req.query.orderId ?? req.query.mdOrder ?? "");
    const st = await gateway.status(gwOrderId).catch(() => ({ paid: false }) as GwStatus);
    const card = db.prepare("SELECT * FROM cards WHERE gateway_order_id = ?").get(gwOrderId) as any;
    if (card) {
      if (st.paid && st.bindingId) {
        db.prepare("UPDATE cards SET status = 'active', binding_id = ?, masked_pan = ?, expiry = ? WHERE id = ?").run(
          st.bindingId, st.maskedPan ?? null, st.expiry ?? null, card.id,
        );
        gateway.reverse(gwOrderId).catch((e) => console.warn("[card] reverse failed", e.message));
      } else {
        db.prepare("UPDATE cards SET status = 'failed' WHERE id = ?").run(card.id);
      }
      return res.redirect(`/card/done?ok=${st.paid && st.bindingId ? 1 : 0}`);
    }
    const order = db.prepare("SELECT * FROM orders WHERE gateway_order_id = ?").get(gwOrderId) as any;
    if (order && st.paid) await markPaid(order.id, gwOrderId, "card");
    res.redirect(`/card/done?ok=${order && st.paid ? 1 : 0}`);
  });
  r.get("/card/done", (req, res) => res.send(done(req.query.ok === "1")));

  // Fake bank page (CARD_MOCK=1)
  r.get("/card/mock-form/:id", (req, res) => {
    const o = mockOrders.get(req.params.id);
    if (!o) return res.status(404).end();
    res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;padding:24px;max-width:420px;margin:auto">
<h2>Bank page — TEST MODE</h2><p>${o.description}</p><h1>${o.amount} ֏</h1>
<form method="post"><input name="pan" value="4111 1111 1111 1111" style="font-size:18px;width:100%;padding:10px">
<p><button style="font-size:18px;padding:12px 24px">Pay</button></p></form></body>`);
  });
  r.post("/card/mock-form/:id", (req, res) => {
    const o = mockOrders.get(req.params.id);
    if (!o) return res.status(404).end();
    const digits = String(req.body.pan ?? "").replace(/\D/g, "");
    o.status = {
      paid: true,
      bindingId: "bind-" + randomUUID(),
      maskedPan: `${digits.slice(0, 4)} ${digits.slice(4, 6)}** **** ${digits.slice(-4)}`,
      expiry: "203012",
    };
    res.redirect(`${o.returnUrl}?orderId=${req.params.id}`);
  });
  return r;
}
