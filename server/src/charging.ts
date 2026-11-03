// Charging + billing logic. Prepaid model:
//   user pays N AMD -> session gets a budget of N -> charger stops when cost reaches budget
//   -> unspent remainder is credited to the user's in-app balance (usable next time).
import { db, q, newId, newIdTag, type Session } from "./db.ts";
import { call, isOnline } from "./ocpp.ts";

const START_TIMEOUT_MS = 3 * 60 * 1000; // user has 3 min to plug in after paying

const now = () => new Date().toISOString();

function costFor(energyWh: number, pricePerKwh: number) {
  return Math.ceil((energyWh / 1000) * pricePerKwh);
}

function refund(session: Session, reason: string, error?: string) {
  const s = q.session(session.id)!;
  if (s.refunded || s.status === "finished" || s.status === "failed") return;
  const cost = Math.min(s.cost, s.budget);
  const back = s.budget - cost;
  db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(back, s.user_id);
  db.prepare(
    "UPDATE sessions SET status = ?, cost = ?, refunded = 1, stop_reason = ?, error = ?, stopped_at = ? WHERE id = ?",
  ).run(error ? "failed" : "finished", cost, reason, error ?? null, now(), s.id);
  console.log(`[billing] session ${s.id} closed (${reason}), cost ${cost}, returned ${back} AMD to balance`);
}

export const charging = {
  /** Called once an order is fully paid. Creates a session and asks the charger to start. */
  async startForOrder(orderId: number): Promise<Session> {
    const order = q.order(orderId)!;
    if (order.session_id) return q.session(order.session_id)!;
    const station = q.station(order.station_id)!;
    const id = newId();
    db.prepare(
      `INSERT INTO sessions (id, order_id, user_id, station_id, connector_id, id_tag, budget, price_per_kwh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, order.id, order.user_id, order.station_id, order.connector_id, newIdTag(),
      order.amount + order.from_balance, station.price_per_kwh,
    );
    db.prepare("UPDATE orders SET session_id = ? WHERE id = ?").run(id, order.id);
    const session = q.session(id)!;

    if (!isOnline(station.id)) {
      refund(session, "station_offline", "station_offline");
      return q.session(id)!;
    }
    try {
      const res = await call(station.id, "RemoteStartTransaction", {
        connectorId: session.connector_id,
        idTag: session.id_tag,
      });
      if (res.status !== "Accepted") refund(session, "remote_start_rejected", "remote_start_rejected");
    } catch (e) {
      refund(session, "remote_start_error", (e as Error).message);
    }
    return q.session(id)!;
  },

  async stop(sessionId: string, reason = "user") {
    const s = q.session(sessionId);
    if (!s) throw new Error("not_found");
    if (s.status === "starting") {
      // Not plugged in yet: just cancel and return the money
      refund(s, "cancelled_before_start");
      return q.session(sessionId)!;
    }
    if (s.status !== "charging" || s.transaction_id == null) return s;
    db.prepare("UPDATE sessions SET status = 'stopping', stop_reason = ? WHERE id = ?").run(reason, s.id);
    try {
      await call(s.station_id, "RemoteStopTransaction", { transactionId: s.transaction_id });
    } catch (e) {
      console.warn(`[charging] RemoteStop failed for ${s.id}:`, (e as Error).message);
      db.prepare("UPDATE sessions SET status = 'charging' WHERE id = ?").run(s.id);
      throw e;
    }
    return q.session(sessionId)!;
  },

  isKnownTag(stationId: string, idTag: string) {
    const row = db
      .prepare("SELECT 1 FROM sessions WHERE station_id = ? AND id_tag = ? AND status IN ('starting','charging')")
      .get(stationId, idTag);
    return !!row;
  },

  onStartTransaction(stationId: string, p: any) {
    const s = q.pendingSessionByTag(stationId, p.idTag);
    if (!s) return { transactionId: 0, idTagInfo: { status: "Invalid" } };
    // Use the session's row number as a stable integer transaction id
    const txId = Number((db.prepare("SELECT rowid FROM sessions WHERE id = ?").get(s.id) as any).rowid);
    db.prepare(
      "UPDATE sessions SET status = 'charging', transaction_id = ?, meter_start = ?, meter_now = ?, started_at = ? WHERE id = ?",
    ).run(txId, p.meterStart, p.meterStart, p.timestamp ?? now(), s.id);
    return { transactionId: txId, idTagInfo: { status: "Accepted" } };
  },

  onMeterValues(stationId: string, p: any) {
    if (p.transactionId == null) return;
    const s = q.sessionByTx(stationId, p.transactionId);
    if (!s || s.meter_start == null) return;
    let energyReg: number | null = null;
    let power: number | null = null;
    for (const mv of p.meterValue ?? []) {
      for (const sv of mv.sampledValue ?? []) {
        const measurand = sv.measurand ?? "Energy.Active.Import.Register";
        const v = Number(sv.value);
        if (Number.isNaN(v)) continue;
        if (measurand === "Energy.Active.Import.Register") energyReg = sv.unit === "kWh" ? v * 1000 : v;
        if (measurand === "Power.Active.Import") power = sv.unit === "kW" ? v * 1000 : v;
      }
    }
    if (energyReg == null) return;
    const energyWh = Math.max(0, Math.round(energyReg - s.meter_start));
    const cost = costFor(energyWh, s.price_per_kwh);
    db.prepare("UPDATE sessions SET meter_now = ?, energy_wh = ?, cost = ?, power_w = COALESCE(?, power_w) WHERE id = ?").run(
      Math.round(energyReg), energyWh, Math.min(cost, s.budget), power, s.id,
    );
    if (cost >= s.budget && s.status === "charging") {
      charging.stop(s.id, "budget_reached").catch(() => {});
    }
  },

  onStopTransaction(stationId: string, p: any) {
    const s = q.sessionByTx(stationId, p.transactionId);
    if (!s) return;
    const energyWh = Math.max(0, p.meterStop - (s.meter_start ?? p.meterStop));
    db.prepare("UPDATE sessions SET meter_now = ?, energy_wh = ?, cost = ?, power_w = 0 WHERE id = ?").run(
      p.meterStop, energyWh, Math.min(costFor(energyWh, s.price_per_kwh), s.budget), s.id,
    );
    refund(s, s.stop_reason ?? p.reason ?? "Local");
  },

  /** Cancel sessions where the car was never plugged in. */
  sweep() {
    const rows = db.prepare("SELECT * FROM sessions WHERE status = 'starting'").all() as Session[];
    for (const s of rows) {
      if (Date.now() - new Date(s.created_at.replace(" ", "T") + "Z").getTime() > START_TIMEOUT_MS) {
        refund(s, "not_plugged_in");
      }
    }
  },
};

setInterval(() => charging.sweep(), 15000).unref();
