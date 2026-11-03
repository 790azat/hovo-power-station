import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, DEMO } from "./config";
import { demoApi } from "./demo";

export type Connector = { id: number; type: string; maxKw: number; status: string; busy: boolean };
export type Station = {
  id: string; name: string; address: string; lat: number | null; lng: number | null;
  pricePerKwh: number; online: boolean; freeConnectors: number; minAmount: number; maxAmount: number; connectors: Connector[];
};
export type Session = {
  id: string; stationId: string; stationName: string; connectorId: number;
  status: "starting" | "charging" | "stopping" | "finished" | "failed";
  budget: number; pricePerKwh: number; energyKwh: number; powerKw: number; cost: number;
  stopReason: string | null; error: string | null;
  createdAt: string; startedAt: string | null; stoppedAt: string | null;
};
export type SavedCard = { id: string; maskedPan: string | null; expiry: string | null };
export type PayMethod = { kind: "idram" } | { kind: "card"; cardId: string };
export type Me = { id: string; balance: number; active: Session[] };
export type OrderResult =
  | { orderId: number; paid: true; sessionId: string }
  | { orderId: number; paid: false; amount: number; fromBalance: number; payUrl: string };

import { ApiError } from "./errors";
export { ApiError };

let cachedUserId: string | null = null;
async function getUserId() {
  if (cachedUserId) return cachedUserId;
  let id = await AsyncStorage.getItem("hovo.userId");
  if (!id) {
    id = "u-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
    await AsyncStorage.setItem("hovo.userId", id);
  }
  cachedUserId = id;
  return id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-user-id": await getUserId(), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError("network", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? "error", res.status);
  return body as T;
}

const realApi = {
  me: () => request<Me>("/me"),
  history: () => request<Session[]>("/me/sessions"),
  stations: () => request<Station[]>("/stations"),
  station: (id: string) => request<Station>(`/stations/${encodeURIComponent(id)}`),
  createOrder: (stationId: string, connectorId: number, amount: number, pay: PayMethod) =>
    request<OrderResult>("/orders", {
      method: "POST",
      body: JSON.stringify({ stationId, connectorId, amount, method: pay.kind, cardId: pay.kind === "card" ? pay.cardId : undefined }),
    }),
  cards: () => request<SavedCard[]>("/me/cards"),
  linkCard: () => request<{ cardId: string; formUrl: string }>("/me/cards", { method: "POST" }),
  cardStatus: (id: string) => request<{ id: string; status: string; maskedPan: string | null }>(`/me/cards/${id}`),
  deleteCard: (id: string) => request<{ ok: true }>(`/me/cards/${id}`, { method: "DELETE" }),
  order: (id: number) => request<{ id: number; status: string; sessionId: string | null }>(`/orders/${id}`),
  session: (id: string) => request<Session>(`/sessions/${id}`),
  stop: (id: string) => request<Session>(`/sessions/${id}/stop`, { method: "POST" }),
};

export type Api = typeof realApi;

// DEMO mode runs a fake server inside the app (for the browser test version).
export const api: Api = DEMO ? demoApi : realApi;

/** QR on the charger: "hovo://station/HOVO-001?connector=1", an https link with the same path, or just "HOVO-001". */
export function parseStationQr(data: string): { stationId: string; connector?: number } | null {
  const text = data.trim();
  const m = text.match(/station\/([A-Za-z0-9_.-]+)(?:\?.*connector=(\d+))?/);
  if (m) return { stationId: m[1], connector: m[2] ? Number(m[2]) : undefined };
  if (/^[A-Za-z0-9_.-]{3,40}$/.test(text)) return { stationId: text };
  return null;
}
