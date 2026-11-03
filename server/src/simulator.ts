// Fake OCPP 1.6 charger for testing without hardware.
//   node src/simulator.ts [stationId] [serverWsUrl]
// It accepts RemoteStart, "plugs in" immediately, charges at 11 kW (sped up 60x) and sends MeterValues every 2s.
import WebSocket from "ws";
import { randomUUID } from "node:crypto";

const stationId = process.argv[2] ?? "HOVO-001";
const url = (process.argv[3] ?? "ws://localhost:8080/ocpp") + "/" + stationId;
const POWER_W = 11000;
const SPEEDUP = 60;

let meterWh = 100000;
const tx = new Map<number, { txId: number; timer: NodeJS.Timeout }>(); // connectorId -> tx
const waiting = new Map<string, (v: any) => void>();

const ws = new WebSocket(url, ["ocpp1.6"]);
const send = (action: string, payload: object) =>
  new Promise<any>((resolve) => {
    const id = randomUUID();
    waiting.set(id, resolve);
    ws.send(JSON.stringify([2, id, action, payload]));
  });
const status = (connectorId: number, s: string) =>
  send("StatusNotification", { connectorId, errorCode: "NoError", status: s, timestamp: new Date().toISOString() });

ws.on("open", async () => {
  console.log(`[sim] connected as ${stationId}`);
  await send("BootNotification", { chargePointVendor: "Sim", chargePointModel: "Hovo-Sim" });
  await status(1, "Available");
  await status(2, "Available");
  setInterval(() => send("Heartbeat", {}), 60000);
});

ws.on("message", async (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg[0] === 3) {
    waiting.get(msg[1])?.(msg[2]);
    waiting.delete(msg[1]);
    return;
  }
  if (msg[0] !== 2) return;
  const [, id, action, p] = msg;
  const reply = (payload: object) => ws.send(JSON.stringify([3, id, payload]));

  if (action === "RemoteStartTransaction") {
    const connectorId = p.connectorId ?? 1;
    if (tx.has(connectorId)) return reply({ status: "Rejected" });
    reply({ status: "Accepted" });
    console.log(`[sim] remote start on connector ${connectorId}, tag ${p.idTag}`);
    await status(connectorId, "Preparing");
    const res = await send("StartTransaction", {
      connectorId, idTag: p.idTag, meterStart: meterWh, timestamp: new Date().toISOString(),
    });
    if (res.idTagInfo?.status !== "Accepted") return status(connectorId, "Available");
    await status(connectorId, "Charging");
    const timer = setInterval(() => {
      meterWh += Math.round((POWER_W * 2 * SPEEDUP) / 3600);
      send("MeterValues", {
        connectorId, transactionId: res.transactionId,
        meterValue: [{
          timestamp: new Date().toISOString(),
          sampledValue: [
            { value: String(meterWh), measurand: "Energy.Active.Import.Register", unit: "Wh" },
            { value: String(POWER_W), measurand: "Power.Active.Import", unit: "W" },
          ],
        }],
      });
    }, 2000);
    tx.set(connectorId, { txId: res.transactionId, timer });
  } else if (action === "RemoteStopTransaction") {
    const entry = [...tx.entries()].find(([, t]) => t.txId === p.transactionId);
    if (!entry) return reply({ status: "Rejected" });
    reply({ status: "Accepted" });
    const [connectorId, t] = entry;
    clearInterval(t.timer);
    tx.delete(connectorId);
    await send("StopTransaction", {
      transactionId: t.txId, meterStop: meterWh, timestamp: new Date().toISOString(), reason: "Remote",
    });
    await status(connectorId, "Available");
    console.log(`[sim] stopped tx ${t.txId}`);
  } else {
    reply({});
  }
});

ws.on("close", () => {
  console.log("[sim] disconnected");
  process.exit(1);
});
