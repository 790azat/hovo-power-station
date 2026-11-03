// End-to-end: server + simulated charger + mock Idram. Run: npm test
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "hovo-"));
const procs: ReturnType<typeof spawn>[] = [];
const run = (args: string[], env: Record<string, string> = {}) => {
  const p = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", ...args], {
    env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "inherit"],
  });
  procs.push(p);
  return p;
};
after(() => procs.forEach((p) => p.kill()));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async <T>(fn: () => Promise<T | undefined>, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    await sleep(300);
  }
  throw new Error("timeout");
};
const USER = "test-user-0001";
const j = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(BASE + path, {
    ...init, headers: { "content-type": "application/json", "x-user-id": USER, ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json() };
};

test("pay with Idram (mock), charge, stop, remainder goes to balance", async () => {
  run(["src/index.ts"], { PORT: String(PORT), PUBLIC_URL: BASE, DB_FILE: join(dir, "t.db"), IDRAM_MOCK: "1" });
  await until(async () => (await fetch(BASE + "/health")).ok);
  run(["src/simulator.ts", "HOVO-001", `ws://localhost:${PORT}/ocpp`]);
  await until(async () => (await j("/api/stations/HOVO-001")).body.online);
  const list = await j("/api/stations");
  assert.equal(list.body.length, 1);
  assert.equal(typeof list.body[0].lat, "number");
  await until(async () => (await j("/api/stations")).body[0].freeConnectors === 2);

  const order = await j("/api/orders", { method: "POST", body: JSON.stringify({ stationId: "HOVO-001", connectorId: 1, amount: 5000 }) });
  assert.equal(order.status, 200);
  assert.equal(order.body.paid, false);
  assert.match(order.body.payUrl, /\/pay\/\d+$/);

  // Payment page renders, then the "Pay" button posts to mock-pay
  const page = await fetch(order.body.payUrl);
  assert.match(await page.text(), /TEST MODE/);
  const pay = await fetch(`${BASE}/idram/mock-pay/${order.body.orderId}`, { method: "POST", redirect: "manual" });
  assert.equal(pay.status, 302);

  const o = await until(async () => { const r = await j(`/api/orders/${order.body.orderId}`); return r.body.sessionId ? r.body : undefined; });
  const charging = await until(async () => { const r = await j(`/api/sessions/${o.sessionId}`); return r.body.energyKwh > 0 ? r.body : undefined; });
  assert.equal(charging.status, "charging");
  assert.ok(charging.cost > 0);

  // Connector is busy for others
  const busy = await j("/api/orders", { method: "POST", body: JSON.stringify({ stationId: "HOVO-001", connectorId: 1, amount: 1000 }) });
  assert.equal(busy.status, 409);

  await j(`/api/sessions/${o.sessionId}/stop`, { method: "POST" });
  const done = await until(async () => { const r = await j(`/api/sessions/${o.sessionId}`); return r.body.status === "finished" ? r.body : undefined; });
  const me = await j("/api/me");
  assert.equal(me.body.balance, 5000 - done.cost);
  assert.equal(me.body.active.length, 0);

  // Next order is paid fully from balance -> starts without Idram
  const o2 = await j("/api/orders", { method: "POST", body: JSON.stringify({ stationId: "HOVO-001", connectorId: 2, amount: 1000 }) });
  assert.equal(o2.body.paid, true);
  assert.ok(o2.body.sessionId);
});

test("Idram precheck and checksum validation", async () => {
  // Separate server in live mode with known credentials
  const port = PORT + 1;
  const base = `http://localhost:${port}`;
  run(["src/index.ts"], { PORT: String(port), PUBLIC_URL: base, DB_FILE: join(dir, "t2.db"), IDRAM_MOCK: "0", IDRAM_REC_ACCOUNT: "110000601", IDRAM_SECRET_KEY: "secret" });
  await until(async () => (await fetch(base + "/health")).ok);
  run(["src/simulator.ts", "HOVO-001", `ws://localhost:${port}/ocpp`]);
  const h = { "content-type": "application/json", "x-user-id": USER };
  await until(async () => (await (await fetch(base + "/api/stations/HOVO-001", { headers: h })).json()).online);
  const order = await (await fetch(base + "/api/orders", { method: "POST", headers: h, body: JSON.stringify({ stationId: "HOVO-001", connectorId: 1, amount: 2000 }) })).json();
  const form = (f: Record<string, string>) => fetch(base + "/idram/result", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(f) }).then((r) => r.text());

  const payPage = await (await fetch(order.payUrl)).text();
  assert.match(payPage, /banking\.idram\.am/);
  assert.match(payPage, /name="EDP_BILL_NO" value="\d+"/);

  assert.equal(await form({ EDP_PRECHECK: "YES", EDP_BILL_NO: String(order.orderId), EDP_REC_ACCOUNT: "110000601", EDP_AMOUNT: "2000" }), "OK");
  assert.equal(await form({ EDP_PRECHECK: "YES", EDP_BILL_NO: String(order.orderId), EDP_REC_ACCOUNT: "110000601", EDP_AMOUNT: "1" }), "ERROR");

  const { createHash } = await import("node:crypto");
  const f = { EDP_REC_ACCOUNT: "110000601", EDP_AMOUNT: "2000", EDP_BILL_NO: String(order.orderId), EDP_PAYER_ACCOUNT: "123", EDP_TRANS_ID: "999", EDP_TRANS_DATE: "02/11/2026" };
  const sum = createHash("md5").update([f.EDP_REC_ACCOUNT, f.EDP_AMOUNT, "secret", f.EDP_BILL_NO, f.EDP_PAYER_ACCOUNT, f.EDP_TRANS_ID, f.EDP_TRANS_DATE].join(":")).digest("hex");
  assert.equal(await form({ ...f, EDP_CHECKSUM: "BAD" }), "ERROR");
  assert.equal(await form({ ...f, EDP_CHECKSUM: sum }), "OK");
  const o = await until(async () => { const r = await (await fetch(`${base}/api/orders/${order.orderId}`, { headers: h })).json(); return r.sessionId ? r : undefined; });
  assert.equal(o.status, "paid");
});

test("link a card (mock bank), pay with it, delete it", async () => {
  const port = PORT + 2;
  const base = `http://localhost:${port}`;
  run(["src/index.ts"], { PORT: String(port), PUBLIC_URL: base, DB_FILE: join(dir, "t3.db"), IDRAM_MOCK: "1", CARD_MOCK: "1" });
  await until(async () => (await fetch(base + "/health")).ok);
  run(["src/simulator.ts", "HOVO-001", `ws://localhost:${port}/ocpp`]);
  const h = { "content-type": "application/json", "x-user-id": "card-user-0001" };
  const call = async (path: string, init: RequestInit = {}) => (await fetch(base + path, { ...init, headers: h })).json();
  await until(async () => (await call("/api/stations/HOVO-001")).online);

  const link = await call("/api/me/cards", { method: "POST" });
  assert.match(link.formUrl, /mock-form/);
  // user submits the card on the bank page; follow redirects like the WebView would
  const r = await fetch(link.formUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "pan=4111111111111111" });
  assert.ok(r.url.endsWith("/card/done?ok=1"));
  const cards = await call("/api/me/cards");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].maskedPan, "4111 11** **** 1111");

  const order = await call("/api/orders", { method: "POST", body: JSON.stringify({ stationId: "HOVO-001", connectorId: 1, amount: 3000, method: "card", cardId: cards[0].id }) });
  assert.equal(order.paid, true);
  const s = await until(async () => { const x = await call(`/api/sessions/${order.sessionId}`); return x.status === "charging" ? x : undefined; });
  assert.equal(s.budget, 3000);

  await call(`/api/me/cards/${cards[0].id}`, { method: "DELETE" });
  assert.equal((await call("/api/me/cards")).length, 0);
});
