// Idram merchant integration (https://idram.am).
// Flow:
//  1. App opens  GET /pay/:orderId  in a WebView -> we render an auto-submitting form to Idram.
//  2. Idram calls our RESULT_URL (POST /idram/result) twice:
//       a) precheck: EDP_PRECHECK=YES -> we answer "OK" if the order exists and amount matches
//       b) confirmation: with EDP_TRANS_ID + EDP_CHECKSUM -> we verify checksum, mark order paid, start charging
//  3. Idram redirects the user to SUCCESS_URL / FAIL_URL (/idram/success, /idram/fail); the app watches for those.
// RESULT_URL, SUCCESS_URL and FAIL_URL are configured in the Idram merchant cabinet.
// NOTE: field names and checksum format follow Idram's merchant docs; re-check against the
// latest document Idram gives you when you sign the contract.
import { createHash } from "node:crypto";
import express, { Router } from "express";
import { config } from "./config.ts";
import { db, q } from "./db.ts";
import { charging } from "./charging.ts";

export const idramRouter = Router();
idramRouter.use(express.urlencoded({ extended: false }));

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;
justify-content:center;min-height:90vh;margin:0 16px;text-align:center;color:#0f172a}
button{font-size:18px;padding:14px 28px;border:0;border-radius:12px;background:#16a34a;color:#fff;margin:6px}
button.secondary{background:#e2e8f0;color:#0f172a}</style></head><body>${body}</body></html>`;

idramRouter.get("/pay/:orderId", (req, res) => {
  const order = q.order(Number(req.params.orderId));
  if (!order || order.status !== "pending") return res.status(404).send(page("Error", "<p>Order not found</p>"));
  const description = `Hovo Power Station: ${order.station_id} #${order.connector_id}`;

  if (config.idram.mock) {
    return res.send(
      page("Idram (test)", `<h2>Idram — TEST MODE</h2><p>${esc(description)}</p><h1>${order.amount} ֏</h1>
      <form method="post" action="/idram/mock-pay/${order.id}"><button>Pay</button></form>
      <form method="get" action="/idram/fail"><button class="secondary">Cancel</button></form>`),
    );
  }

  const fields: Record<string, string> = {
    EDP_LANGUAGE: config.idram.language,
    EDP_REC_ACCOUNT: config.idram.recAccount,
    EDP_DESCRIPTION: description,
    EDP_AMOUNT: String(order.amount),
    EDP_BILL_NO: String(order.id),
  };
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  res.send(
    page("Idram", `<p>Redirecting to Idram…</p>
    <form id="f" method="post" action="${esc(config.idram.paymentUrl)}">${inputs}<button>Continue</button></form>
    <script>document.getElementById('f').submit()</script>`),
  );
});

/** Marks an order paid and starts charging. Idempotent. */
export async function markPaid(orderId: number, transId: string | null, payer: string | null) {
  const order = q.order(orderId);
  if (!order || order.status === "paid") return;
  db.prepare("UPDATE orders SET status = 'paid', idram_trans_id = ?, idram_payer = ?, paid_at = datetime('now') WHERE id = ?").run(
    transId, payer, orderId,
  );
  await charging.startForOrder(orderId);
}

idramRouter.post("/idram/result", async (req, res) => {
  const b = req.body as Record<string, string>;
  const order = q.order(Number(b.EDP_BILL_NO));

  if (b.EDP_PRECHECK === "YES") {
    const ok =
      order && order.status === "pending" && b.EDP_REC_ACCOUNT === config.idram.recAccount &&
      Number(b.EDP_AMOUNT) === order.amount;
    return res.type("text/plain").send(ok ? "OK" : "ERROR");
  }

  const expected = createHash("md5")
    .update(
      [b.EDP_REC_ACCOUNT, b.EDP_AMOUNT, config.idram.secretKey, b.EDP_BILL_NO, b.EDP_PAYER_ACCOUNT, b.EDP_TRANS_ID, b.EDP_TRANS_DATE].join(":"),
    )
    .digest("hex");
  if (!order || !b.EDP_CHECKSUM || expected.toUpperCase() !== b.EDP_CHECKSUM.toUpperCase() || Number(b.EDP_AMOUNT) !== order.amount) {
    console.warn("[idram] bad confirmation", { bill: b.EDP_BILL_NO });
    return res.type("text/plain").send("ERROR");
  }
  res.type("text/plain").send("OK");
  markPaid(order.id, b.EDP_TRANS_ID, b.EDP_PAYER_ACCOUNT).catch((e) => console.error("[idram] start failed", e));
});

idramRouter.post("/idram/mock-pay/:orderId", async (req, res) => {
  if (!config.idram.mock) return res.status(404).end();
  await markPaid(Number(req.params.orderId), "MOCK-" + Date.now(), "MOCK");
  res.redirect(`/idram/success?EDP_BILL_NO=${req.params.orderId}`);
});

const backToApp = (path = "/") => `<script>setTimeout(function(){location.href=${JSON.stringify(path)}},1500)</script>`;
idramRouter.all("/idram/success", (req, res) => {
  const bill = Number((req.query.EDP_BILL_NO ?? req.body?.EDP_BILL_NO) as string);
  const sessionId = bill ? q.order(bill)?.session_id : null;
  res.send(page("OK", "<h2>✅ Payment received</h2>" + backToApp(sessionId ? `/session/${sessionId}` : "/")));
});
idramRouter.all("/idram/fail", (req, res) => {
  const bill = Number((req.query.EDP_BILL_NO ?? req.body?.EDP_BILL_NO) as string);
  if (bill) db.prepare("UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'pending'").run(bill);
  res.send(page("Fail", "<h2>Payment cancelled</h2>" + backToApp()));
});
