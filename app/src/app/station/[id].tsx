// Station: choose connector, amount and payment method, then pay.
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError, type Connector, type PayMethod, type SavedCard, type Station } from "../../lib/api";
import { openRoute } from "../../lib/route";
import { notify } from "../../lib/alert";
import { errorText, useT } from "../../lib/i18n";
import { amd, colors, font, gradients, radius } from "../../lib/theme";
import { Button, Center, Chip, Label, Selectable } from "../../components/ui";

const PRESETS = [1000, 3000, 5000, 10000];
const isFree = (c: Connector) => c.status === "Available" && !c.busy;

export default function StationScreen() {
  const { id, connector } = useLocalSearchParams<{ id: string; connector?: string }>();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [station, setStation] = useState<Station | null>(null);
  const [balance, setBalance] = useState(0);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectorId, setConnectorId] = useState<number | null>(connector ? Number(connector) : null);
  const [amount, setAmount] = useState(3000);
  const [custom, setCustom] = useState("");
  const [pay, setPay] = useState<PayMethod>({ kind: "idram" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.station(id).then((s) => {
      setStation(s);
      setError(null);
      setConnectorId((cur) => {
        if (cur) return cur;
        const free = s.connectors.filter(isFree);
        return free.length >= 1 ? free[0].id : null;
      });
    }).catch((e) => setError(errorText(t, e instanceof ApiError ? e.code : "generic")));
    api.me().then((m) => setBalance(m.balance)).catch(() => {});
    api.cards().then((c) => {
      setCards(c);
      setPay((cur) => (cur.kind === "idram" && c.length ? { kind: "card", cardId: c[c.length - 1].id } : cur));
    }).catch(() => {});
  }, [id, t]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (error) {
    return (
      <Center>
        <Text style={{ fontSize: 44 }}>⚠️</Text>
        <Text style={[font.body, { textAlign: "center" }]}>{error}</Text>
        <Button title={t("retry")} onPress={load} style={{ alignSelf: "stretch" }} />
      </Center>
    );
  }
  if (!station) return <Center><Text style={font.small}>…</Text></Center>;

  const total = custom ? Number(custom) || 0 : amount;
  const fromBalance = Math.min(balance, total);
  const toPay = total - fromBalance;
  const estKwh = total / station.pricePerKwh;
  const canPay = station.online && connectorId != null && total >= station.minAmount && total <= station.maxAmount;

  const submit = async () => {
    if (connectorId == null) return;
    setBusy(true);
    try {
      const r = await api.createOrder(station.id, connectorId, total, pay);
      if (r.paid) router.replace(`/session/${r.sessionId}`);
      else router.push({ pathname: "/pay/[orderId]", params: { orderId: String(r.orderId), url: r.payUrl } });
    } catch (e) {
      notify(errorText(t, e instanceof ApiError ? e.code : "generic"));
      load();
    } finally {
      setBusy(false);
    }
  };

  const payTitle =
    toPay === 0 ? t("startFromBalance") : pay.kind === "idram" ? `${t("payIdram")} · ${amd(toPay)}` : `${t("payCard")} · ${amd(toPay)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 130 + insets.bottom }}>
        {/* Hero */}
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={font.h1}>{station.name}</Text>
              {!!station.address && <Text style={font.small}>{station.address}</Text>}
            </View>
            <View style={s.boltBadge}><Text style={{ fontSize: 26 }}>⚡</Text></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {station.online ? <Chip text={`${station.freeConnectors} ${t("freeOf")}`} tone={station.freeConnectors ? "primary" : "warn"} /> : <Chip text={t("offline")} tone="danger" />}
            <Chip text={`${station.pricePerKwh} ${t("perKwh")}`} tone="offline" />
          </View>
          {station.lat != null && station.lng != null && (
            <Pressable onPress={() => openRoute(station.lat!, station.lng!)} style={s.routeBtn}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>🧭  {t("route")} · Yandex</Text>
            </Pressable>
          )}
        </LinearGradient>

        {/* Connectors */}
        <View style={{ gap: 10 }}>
          <Label>{t("chooseConnector")}</Label>
          {station.connectors.map((c) => {
            const free = isFree(c);
            const busyNow = c.busy || c.status === "Charging" || c.status === "Preparing";
            return (
              <Selectable key={c.id} selected={connectorId === c.id} disabled={!free} onPress={() => setConnectorId(c.id)} style={s.row}>
                <View style={[s.plug, connectorId === c.id && { backgroundColor: colors.primary }]}>
                  <Text style={[s.plugText, connectorId === c.id && { color: colors.onPrimary }]}>{c.id}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{c.type}</Text>
                  <Text style={font.small}>{c.maxKw} {t("kw")}</Text>
                </View>
                <Chip text={free ? t("free") : busyNow ? t("busy") : t("unavailable")} tone={free ? "primary" : busyNow ? "warn" : "offline"} />
              </Selectable>
            );
          })}
        </View>

        {/* Amount */}
        <View style={{ gap: 10 }}>
          <Label>{t("chooseAmount")}</Label>
          <View style={s.presets}>
            {PRESETS.map((p) => {
              const on = !custom && amount === p;
              return (
                <Selectable key={p} selected={on} onPress={() => { setAmount(p); setCustom(""); }} style={s.preset}>
                  <Text style={[s.presetText, on && { color: colors.primary }]}>{amd(p)}</Text>
                  <Text style={font.small}>≈ {(p / station.pricePerKwh).toFixed(0)} {t("kwh")}</Text>
                </Selectable>
              );
            })}
          </View>
          <TextInput
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/\D/g, ""))}
            placeholder={`${station.minAmount} – ${station.maxAmount} ֏`}
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            style={[s.input, !!custom && { borderColor: colors.primary }]}
          />
          <View style={s.summary}>
            <View>
              <Text style={font.small}>{t("energy")}</Text>
              <Text style={s.summaryVal}>≈ {estKwh.toFixed(1)} {t("kwh")}</Text>
            </View>
            {fromBalance > 0 && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={font.small}>{t("fromBalanceNote")}</Text>
                <Text style={[s.summaryVal, { color: colors.primary }]}>−{amd(fromBalance)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment */}
        {toPay > 0 && (
          <View style={{ gap: 10 }}>
            <Label>{t("payWith")}</Label>
            {cards.map((c) => (
              <Selectable key={c.id} selected={pay.kind === "card" && pay.cardId === c.id} onPress={() => setPay({ kind: "card", cardId: c.id })} style={s.row}>
                <View style={[s.payIcon, { backgroundColor: "#1e3a8a" }]}><Text style={s.payIconText}>💳</Text></View>
                <Text style={[s.rowTitle, { flex: 1 }]}>{c.maskedPan ?? "••••"}</Text>
                <Radio on={pay.kind === "card" && pay.cardId === c.id} />
              </Selectable>
            ))}
            <Selectable selected={pay.kind === "idram"} onPress={() => setPay({ kind: "idram" })} style={s.row}>
              <View style={[s.payIcon, { backgroundColor: "#f97316" }]}><Text style={[s.payIconText, { color: "#fff", fontWeight: "900" }]}>i</Text></View>
              <Text style={[s.rowTitle, { flex: 1 }]}>Idram</Text>
              <Radio on={pay.kind === "idram"} />
            </Selectable>
            <Pressable onPress={() => router.push("/cards")} style={s.addCard}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>{t("addCard")}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Sticky pay bar */}
      <View style={[s.payBar, { paddingBottom: insets.bottom + 14 }]}>
        <Button title={payTitle} onPress={submit} disabled={!canPay} loading={busy} />
      </View>
    </View>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <View style={[s.radio, on && { borderColor: colors.primary }]}>
      {on && <View style={s.radioDot} />}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.borderStrong },
  boltBadge: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  routeBtn: { alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primarySoft },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  plug: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  plugText: { fontSize: 17, fontWeight: "900", color: colors.text },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preset: { flexGrow: 1, flexBasis: "45%", alignItems: "center", gap: 2, paddingVertical: 14 },
  presetText: { fontSize: 19, fontWeight: "800", color: colors.text },
  input: {
    height: 54, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, fontSize: 17,
    color: colors.text, backgroundColor: colors.card,
  },
  summary: {
    flexDirection: "row", justifyContent: "space-between", padding: 16, borderRadius: radius.md,
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border,
  },
  summaryVal: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 2 },
  payIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  payIconText: { fontSize: 20 },
  addCard: { paddingVertical: 14, alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.faint, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  payBar: {
    position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: colors.bgElevated, borderTopWidth: 1, borderColor: colors.border,
  },
});
