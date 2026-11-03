// Minimal OCPP 1.6J central system (Central System = our server, Charge Point = the charger).
// Chargers connect to  ws(s)://<server>/ocpp/<chargePointId>  with subprotocol "ocpp1.6".
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { db, q } from "./db.ts";
import { charging } from "./charging.ts";

const CALL = 2, CALLRESULT = 3, CALLERROR = 4;

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
const sockets = new Map<string, WebSocket>();
const pending = new Map<string, Pending>();

export function isOnline(stationId: string) {
  return sockets.get(stationId)?.readyState === WebSocket.OPEN;
}

/** Send a command to a charger and wait for its answer. */
export function call(stationId: string, action: string, payload: object, timeoutMs = 30000): Promise<any> {
  const ws = sockets.get(stationId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("station_offline"));
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("station_timeout"));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify([CALL, id, action, payload]));
  });
}

const now = () => new Date().toISOString();

// Handlers for messages the charger sends to us
const handlers: Record<string, (stationId: string, p: any) => object | Promise<object>> = {
  BootNotification: (stationId) => {
    db.prepare("UPDATE stations SET online = 1, last_seen = ? WHERE id = ?").run(now(), stationId);
    return { status: "Accepted", currentTime: now(), interval: 60 };
  },
  Heartbeat: (stationId) => {
    db.prepare("UPDATE stations SET last_seen = ? WHERE id = ?").run(now(), stationId);
    return { currentTime: now() };
  },
  StatusNotification: (stationId, p) => {
    if (p.connectorId > 0) {
      db.prepare(
        "INSERT INTO connectors (station_id, connector_id, status) VALUES (?, ?, ?) " +
          "ON CONFLICT(station_id, connector_id) DO UPDATE SET status = excluded.status",
      ).run(stationId, p.connectorId, p.status);
    }
    return {};
  },
  Authorize: (stationId, p) => ({ idTagInfo: { status: charging.isKnownTag(stationId, p.idTag) ? "Accepted" : "Invalid" } }),
  StartTransaction: (stationId, p) => charging.onStartTransaction(stationId, p),
  MeterValues: (stationId, p) => {
    charging.onMeterValues(stationId, p);
    return {};
  },
  StopTransaction: (stationId, p) => {
    charging.onStopTransaction(stationId, p);
    return { idTagInfo: { status: "Accepted" } };
  },
  DataTransfer: () => ({ status: "UnknownVendorId" }),
  DiagnosticsStatusNotification: () => ({}),
  FirmwareStatusNotification: () => ({}),
};

export function attachOcpp(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has("ocpp1.6") ? "ocpp1.6" : false),
  });

  server.on("upgrade", (req, socket, head) => {
    const m = req.url?.match(/^\/ocpp\/([^/?]+)/);
    if (!m) return socket.destroy();
    const stationId = decodeURIComponent(m[1]);
    if (!q.station(stationId)) {
      console.warn(`[ocpp] unknown charge point ${stationId}, rejecting`);
      return socket.destroy();
    }
    // TODO: production should require Basic auth (OCPP security profile 1/2) and wss://
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(stationId, ws));
  });
}

function onConnection(stationId: string, ws: WebSocket) {
  console.log(`[ocpp] ${stationId} connected`);
  sockets.get(stationId)?.terminate();
  sockets.set(stationId, ws);
  db.prepare("UPDATE stations SET online = 1, last_seen = ? WHERE id = ?").run(now(), stationId);

  ws.on("message", async (raw) => {
    let msg: any[];
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const [type, id] = msg;
    if (type === CALL) {
      const [, , action, payload] = msg;
      const h = handlers[action];
      if (!h) return ws.send(JSON.stringify([CALLERROR, id, "NotImplemented", `${action} not supported`, {}]));
      try {
        const res = await h(stationId, payload);
        ws.send(JSON.stringify([CALLRESULT, id, res]));
      } catch (e) {
        console.error(`[ocpp] ${stationId} ${action} failed`, e);
        ws.send(JSON.stringify([CALLERROR, id, "InternalError", String(e), {}]));
      }
    } else if (type === CALLRESULT || type === CALLERROR) {
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      if (type === CALLRESULT) p.resolve(msg[2]);
      else p.reject(new Error(`${msg[2]}: ${msg[3]}`));
    }
  });

  ws.on("close", () => {
    if (sockets.get(stationId) === ws) {
      sockets.delete(stationId);
      db.prepare("UPDATE stations SET online = 0 WHERE id = ?").run(stationId);
      console.log(`[ocpp] ${stationId} disconnected`);
    }
  });
}
