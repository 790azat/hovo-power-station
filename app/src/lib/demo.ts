// In-app fake server for DEMO mode (EXPO_PUBLIC_DEMO=1).
// Behaves like the real server: stations, Idram / card payment pages, charging that speeds up time,
// stop when the paid amount is used up, remainder back to balance. Data is kept on the device.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Api, Me, OrderResult, SavedCard, Session, Station } from "./api";
import { ApiError } from "./errors";

const SPEEDUP = 40; // 1 real second = 40 seconds of charging
const KEY = "hovo.demo.v1";

type StationSeed = Omit<Station, "freeConnectors" | "minAmount" | "maxAmount">;
const STATIONS: StationSeed[] = [
  {
    id: "HOVO-001", name: "Hovo Power Station", address: "Yerevan, Tigran Mets Ave", lat: 40.1728, lng: 44.5126,
    pricePerKwh: 120, online: true,
    connectors: [
      { id: 1, type: "Type 2", maxKw: 22, status: "Available", busy: false },
      { id: 2, type: "CCS2", maxKw: 60, status: "Available", busy: false },
    ],
  },
  {
    id: "HOVO-002", name: "Hovo Komitas", address: "Yerevan, Komitas Ave", lat: 40.2052, lng: 44.5149,
    pricePerKwh: 120, online: true,
    connectors: [{ id: 1, type: "Type 2", maxKw: 22, status: "Charging", busy: true }],
  },
  {
    id: "HOVO-003", name: "Hovo Davtashen", address: "Yerevan, Davtashen", lat: 40.2265, lng: 44.4843,
    pricePerKwh: 110, online: false,
    connectors: [{ id: 1, type: "Type 2", maxKw: 11, status: "Unavailable", busy: false }],
  },
];

type Order = { id: number; stationId: string; connectorId: number; amount: number; fromBalance: number; status: string; sessionId: string | null; cardId?: string };
type DemoSession = Session & { chargeStartMs: number | null; powerW: number };
type State = { balance: number; cards: (SavedCard & { status: string })[]; orders: Order[]; sessions: DemoSession[]; nextOrder: number };

let state: State = { balance: 0, cards: [], orders: [], sessions: [], nextOrder: 1 };
const loaded = AsyncStorage.getItem(KEY).then((raw) => {
  if (raw) state = { ...state, ...JSON.parse(raw) };
}).catch(() => {});
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

/** Advance simulated charging for one session. */
function tick(s: DemoSession) {
  if (s.status === "starting" && Date.now() - new Date(s.createdAt).getTime() > 4000) {
    s.status = "charging";
    s.startedAt = now();
    s.chargeStartMs = Date.now();
  }
  if (s.status === "charging" && s.chargeStartMs) {
    const hours = ((Date.now() - s.chargeStartMs) / 3600000) * SPEEDUP;
    const energyKwh = (s.powerW / 1000) * hours;
    s.energyKwh = energyKwh;
    s.powerKw = s.powerW / 1000;
    s.cost = Math.min(s.budget, Math.ceil(energyKwh * s.pricePerKwh));
    if (s.cost >= s.budget) finish(s, "budget_reached");
  }
}

function finish(s: DemoSession, reason: string) {
  if (s.status === "finished" || s.status === "failed") return;
  s.status = "finished";
  s.stopReason = reason;
  s.stoppedAt = now();
  s.powerKw = 0;
  state.balance += s.budget - s.cost;
}

function tickAll() {
  state.sessions.forEach(tick);
  save();
}

function stationView(seed: StationSeed): Station {
  const connectors = seed.connectors.map((c) => {
    const active = state.sessions.find(
      (s) => s.stationId === seed.id && s.connectorId === c.id && ["starting", "charging", "stopping"].includes(s.status),
    );
    return active ? { ...c, busy: true, status: active.status === "charging" ? "Charging" : "Preparing" } : c;
  });
  return {
    ...seed,
    connectors,
    freeConnectors: seed.online ? connectors.filter((c) => c.status === "Available" && !c.busy).length : 0,
    minAmount: 500,
    maxAmount: 50000,
  };
}

function startSession(order: Order) {
  const st = STATIONS.find((x) => x.id === order.stationId)!;
  const conn = st.connectors.find((c) => c.id === order.connectorId)!;
  const s: DemoSession = {
    id: "s-" + uid(), stationId: st.id, stationName: st.name, connectorId: order.connectorId, status: "starting",
    budget: order.amount + order.fromBalance, pricePerKwh: st.pricePerKwh, energyKwh: 0, powerKw: 0, cost: 0,
    stopReason: null, error: null, createdAt: now(), startedAt: null, stoppedAt: null,
    chargeStartMs: null, powerW: Math.min(conn.maxKw, 22) * 1000,
  };
  state.sessions.unshift(s);
  order.status = "paid";
  order.sessionId = s.id;
  save();
  return s;
}

const strip = (s: DemoSession): Session => {
  const { chargeStartMs: _a, powerW: _b, ...rest } = s;
  return rest;
};

/** Fake payment page actions, used by DemoPayPage. url format: demo:<kind>:<id> */
export const demoPay = {
  describe(url: string): { title: string; amount: number } | null {
    const [, kind, id] = url.split(":");
    if (kind === "card-link") return { title: "Bank — link card", amount: 10 };
    const o = state.orders.find((x) => x.id === Number(id));
    if (!o) return null;
    return { title: kind === "idram" ? "Idram" : "Bank", amount: o.amount };
  },
  async complete(url: string, ok: boolean, pan?: string) {
    await loaded;
    const [, kind, id] = url.split(":");
    if (kind === "card-link") {
      const c = state.cards.find((x) => x.id === id);
      if (c) {
        const d = (pan ?? "4111111111111111").replace(/\D/g, "");
        c.status = ok ? "active" : "failed";
        c.maskedPan = `${d.slice(0, 4)} ${d.slice(4, 6)}** **** ${d.slice(-4)}`;
      }
    } else {
      const o = state.orders.find((x) => x.id === Number(id));
      if (o && o.status === "pending") {
        if (ok) startSession(o);
        else {
          o.status = "failed";
          state.balance += o.fromBalance;
        }
      }
    }
    save();
  },
};

export const demoApi: Api = {
  async me(): Promise<Me> {
    await loaded;
    tickAll();
    await delay();
    return {
      id: "demo",
      balance: state.balance,
      active: state.sessions.filter((s) => ["starting", "charging", "stopping"].includes(s.status)).map(strip),
    };
  },
  async history() {
    await loaded;
    tickAll();
    return state.sessions.map(strip);
  },
  async stations() {
    await loaded;
    tickAll();
    await delay();
    return STATIONS.map(stationView);
  },
  async station(id: string) {
    await loaded;
    tickAll();
    await delay();
    const st = STATIONS.find((x) => x.id.toUpperCase() === id.toUpperCase());
    if (!st) throw new ApiError("station_not_found", 404);
    return stationView(st);
  },
  async createOrder(stationId, connectorId, amount, pay): Promise<OrderResult> {
    await loaded;
    await delay(400);
    const st = STATIONS.find((x) => x.id === stationId);
    if (!st) throw new ApiError("station_not_found", 404);
    if (!st.online) throw new ApiError("station_offline", 409);
    const view = stationView(st).connectors.find((c) => c.id === connectorId);
    if (!view || view.busy || view.status !== "Available") throw new ApiError("connector_busy", 409);
    const fromBalance = Math.min(state.balance, amount);
    state.balance -= fromBalance;
    const order: Order = { id: state.nextOrder++, stationId, connectorId, amount: amount - fromBalance, fromBalance, status: "pending", sessionId: null };
    state.orders.push(order);
    if (order.amount === 0) {
      const s = startSession(order);
      return { orderId: order.id, paid: true, sessionId: s.id };
    }
    if (pay.kind === "card") {
      // Saved card: paid instantly, like the real bank binding payment
      const s = startSession(order);
      return { orderId: order.id, paid: true, sessionId: s.id };
    }
    save();
    return { orderId: order.id, paid: false, amount: order.amount, fromBalance, payUrl: `demo:idram:${order.id}` };
  },
  async order(id: number) {
    await loaded;
    const o = state.orders.find((x) => x.id === id);
    if (!o) throw new ApiError("not_found", 404);
    return { id: o.id, status: o.status, sessionId: o.sessionId };
  },
  async session(id: string) {
    await loaded;
    tickAll();
    const s = state.sessions.find((x) => x.id === id);
    if (!s) throw new ApiError("not_found", 404);
    return strip(s);
  },
  async stop(id: string) {
    await loaded;
    await delay(600);
    const s = state.sessions.find((x) => x.id === id);
    if (!s) throw new ApiError("not_found", 404);
    tick(s);
    finish(s, s.status === "starting" ? "cancelled_before_start" : "user");
    save();
    return strip(s);
  },
  async cards() {
    await loaded;
    return state.cards.filter((c) => c.status === "active").map(({ id, maskedPan, expiry }) => ({ id, maskedPan, expiry }));
  },
  async linkCard() {
    await loaded;
    const id = "c-" + uid();
    state.cards.push({ id, maskedPan: null, expiry: "12/30", status: "pending" });
    save();
    return { cardId: id, formUrl: `demo:card-link:${id}` };
  },
  async cardStatus(id: string) {
    await loaded;
    const c = state.cards.find((x) => x.id === id);
    if (!c) throw new ApiError("not_found", 404);
    return { id: c.id, status: c.status, maskedPan: c.maskedPan };
  },
  async deleteCard(id: string) {
    await loaded;
    state.cards = state.cards.filter((c) => c.id !== id);
    save();
    return { ok: true as const };
  },
};
