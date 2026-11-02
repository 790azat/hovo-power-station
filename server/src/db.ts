import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { config } from "./config.ts";

export const db = new DatabaseSync(config.dbFile);

db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,           -- equals OCPP chargePointId
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  price_per_kwh INTEGER NOT NULL, -- AMD
  lat REAL,
  lng REAL,
  online INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT
);
CREATE TABLE IF NOT EXISTS connectors (
  station_id TEXT NOT NULL,
  connector_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'Type 2',
  max_kw REAL NOT NULL DEFAULT 22,
  status TEXT NOT NULL DEFAULT 'Unavailable', -- OCPP status
  PRIMARY KEY (station_id, connector_id)
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0, -- AMD
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  binding_id TEXT,                  -- bank gateway bindingId (set when binding succeeds)
  masked_pan TEXT,                  -- e.g. 4111 11** **** 1111
  expiry TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | failed | deleted
  gateway_order_id TEXT,            -- verification order at the bank
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- used as Idram EDP_BILL_NO
  user_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  connector_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,          -- AMD to pay via Idram
  from_balance INTEGER NOT NULL DEFAULT 0, -- AMD taken from in-app balance
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  method TEXT NOT NULL DEFAULT 'idram', -- idram | card | balance
  card_id TEXT,
  gateway_order_id TEXT,             -- bank order id for card payments
  idram_trans_id TEXT,
  idram_payer TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  connector_id INTEGER NOT NULL,
  id_tag TEXT NOT NULL,
  budget INTEGER NOT NULL,           -- AMD available for this session
  price_per_kwh INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'starting', -- starting | charging | stopping | finished | failed
  transaction_id INTEGER,
  meter_start INTEGER,               -- Wh
  meter_now INTEGER,                 -- Wh
  power_w REAL NOT NULL DEFAULT 0,
  energy_wh INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,   -- AMD
  refunded INTEGER NOT NULL DEFAULT 0,
  stop_reason TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  stopped_at TEXT
);
`);

// Migrations for databases created before a column existed
const addColumn = (table: string, col: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch { /* already there */ }
};
addColumn("stations", "lat REAL");
addColumn("stations", "lng REAL");
addColumn("orders", "method TEXT NOT NULL DEFAULT 'idram'");
addColumn("orders", "card_id TEXT");
addColumn("orders", "gateway_order_id TEXT");

// Seed one station on first start
const s = config.seed;
const existing = db.prepare("SELECT id FROM stations WHERE id = ?").get(s.stationId);
if (!existing) {
  db.prepare("INSERT INTO stations (id, name, address, price_per_kwh, lat, lng) VALUES (?, ?, ?, ?, ?, ?)").run(
    s.stationId, s.stationName, s.stationAddress, s.pricePerKwh, s.lat, s.lng,
  );
  for (let c = 1; c <= s.connectors; c++) {
    db.prepare("INSERT INTO connectors (station_id, connector_id) VALUES (?, ?)").run(s.stationId, c);
  }
}

export type Station = {
  id: string; name: string; address: string; price_per_kwh: number; lat: number | null; lng: number | null; online: number; last_seen: string | null;
};
export type Connector = { station_id: string; connector_id: number; type: string; max_kw: number; status: string };
export type Order = {
  id: number; user_id: string; station_id: string; connector_id: number; amount: number; from_balance: number;
  status: string; method: string; card_id: string | null; gateway_order_id: string | null; idram_trans_id: string | null; idram_payer: string | null; session_id: string | null;
  created_at: string; paid_at: string | null;
};
export type Session = {
  id: string; order_id: number; user_id: string; station_id: string; connector_id: number; id_tag: string;
  budget: number; price_per_kwh: number; status: string; transaction_id: number | null;
  meter_start: number | null; meter_now: number | null; power_w: number; energy_wh: number; cost: number;
  refunded: number; stop_reason: string | null; error: string | null;
  created_at: string; started_at: string | null; stopped_at: string | null;
};

export type Card = {
  id: string; user_id: string; binding_id: string | null; masked_pan: string | null; expiry: string | null;
  status: string; gateway_order_id: string | null; created_at: string;
};

export const q = {
  card: (id: string) => db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined,
  cardsForUser: (userId: string) =>
    db.prepare("SELECT * FROM cards WHERE user_id = ? AND status = 'active' ORDER BY created_at").all(userId) as Card[],
  stations: () => db.prepare("SELECT * FROM stations ORDER BY name").all() as Station[],
  station: (id: string) => db.prepare("SELECT * FROM stations WHERE id = ?").get(id) as Station | undefined,
  connectors: (stationId: string) =>
    db.prepare("SELECT * FROM connectors WHERE station_id = ? ORDER BY connector_id").all(stationId) as Connector[],
  connector: (stationId: string, connectorId: number) =>
    db.prepare("SELECT * FROM connectors WHERE station_id = ? AND connector_id = ?").get(stationId, connectorId) as
      | Connector
      | undefined,
  order: (id: number) => db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined,
  session: (id: string) => db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session | undefined,
  sessionByTx: (stationId: string, txId: number) =>
    db.prepare("SELECT * FROM sessions WHERE station_id = ? AND transaction_id = ?").get(stationId, txId) as
      | Session
      | undefined,
  pendingSessionByTag: (stationId: string, idTag: string) =>
    db.prepare(
      "SELECT * FROM sessions WHERE station_id = ? AND id_tag = ? AND status = 'starting' ORDER BY created_at DESC",
    ).get(stationId, idTag) as Session | undefined,
  activeSessionOnConnector: (stationId: string, connectorId: number) =>
    db.prepare(
      "SELECT * FROM sessions WHERE station_id = ? AND connector_id = ? AND status IN ('starting','charging','stopping')",
    ).get(stationId, connectorId) as Session | undefined,
  activeSessionsForUser: (userId: string) =>
    db.prepare(
      "SELECT * FROM sessions WHERE user_id = ? AND status IN ('starting','charging','stopping') ORDER BY created_at DESC",
    ).all(userId) as Session[],
  sessionsForUser: (userId: string) =>
    db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId) as Session[],
  ensureUser: (userId: string) => {
    db.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").run(userId);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as { id: string; balance: number };
  },
};

export const newId = () => randomUUID();
// OCPP 1.6 idTag is max 20 chars
export const newIdTag = () => "H" + randomUUID().replace(/-/g, "").slice(0, 19).toUpperCase();
