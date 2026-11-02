// Station: choose connector, amount and payment method, then pay.
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, ApiError, type Connector, type PayMethod, type SavedCard, type Station } from "../../lib/api";
import { notify } from "../../lib/alert";
import { errorText, useT } from "../../lib/i18n";
import { amd, colors } from "../../lib/theme";
import { Button, Card, Center } from "../../components/ui";

const PRESETS = [1000, 3000, 5000, 10000];

export default function StationScreen() {
  const { id, connector } = useLocalSearchParams<{ id: string; connector?: string }>();
  const { t } = useT();
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
        return free.length === 1 ? free[0].id : null;
      });
    }).catch((e) => setError(errorText(t, e instanceof ApiError ? e.code : "generic")));
    api.me().then((m) => setBalance(m.balance)).catch(() => {});
    api.cards().then((c) => {
      setCards(c);
      // Default to the last saved card if the user has one
      setPay((cur) => (cur.kind === "idram" && c.length ? { kind: "card", cardId: c[c.length - 1].id } : cur));
    }).catch(() => {});
  }, [id, t]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (error) {
    return (
      <Center>
        <Text style={{ fontSize: 17, color: colors.danger, textAlign: "center" }}>{error}</Text>
        <Button title={t("retry")} onPress={load} />
      </Center>
    );
  }
  if (!station) return <Center><Text style={{ color: colors.muted }}>…</Text></Center>;

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

  const payTitle = toPay === 0 ? t("startFromBalance") : pay.kind === "idram" ? `${t("payIdram")} · ${amd(toPay)}` : `${t("payCard")} · ${amd(toPay)}`;

  return (
    <>
      <Stack.Screen options={{ title: station.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Card style={{ gap: 4 }}>
          <Text style={s.h1}>{station.name}</Text>
          {!!station.address && <Text style={s.muted}>{station.address}</Text>}
          <Text style={s.text}>{t("price")}: {station.pricePerKwh} {t("perKwh")}</Text>
          {!station.online && <Text style={{ color: colors.danger, fontWeight: "600" }}>{t("offline")}</Text>}
        </Card>

        <Text style={s.h2}>{t("chooseConnector")}</Text>
        <View style={{ gap: 10 }}>
          {station.connectors.map((c) => (
            <ConnectorRow key={c.id} c={c} selected={connectorId === c.id} onPress={() => isFree(c) && setConnectorId(c.id)} />
          ))}
        </View>

        <Text style={s.h2}>{t("chooseAmount")}</Text>
        <View style={s.presets}>
          {PRESETS.map((p) => (
            <Pressable key={p} onPress={() => { setAmount(p); setCustom(""); }} style={[s.preset, !custom && amount === p && s.presetOn]}>
              <Text style={[s.presetText, !custom && amount === p && { color: "#fff" }]}>{amd(p)}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={custom}
          onChangeText={(v) => setCustom(v.replace(/\D/g, ""))}
          placeholder={`${station.minAmount} – ${station.maxAmount} ֏`}
          keyboardType="number-pad"
          style={s.input}
        />
        <Text style={s.muted}>
          ≈ {estKwh.toFixed(1)} {t("kwh")}
          {fromBalance > 0 ? ` · ${t("fromBalanceNote")}: ${amd(fromBalance)}` : ""}
        </Text>

        {toPay > 0 && (
          <>
            <Text style={s.h2}>{t("payWith")}</Text>
            <View style={{ gap: 10 }}>
              {cards.map((c) => (
                <MethodRow
                  key={c.id}
                  label={`💳  ${c.maskedPan ?? "••••"}`}
                  selected={pay.kind === "card" && pay.cardId === c.id}
                  onPress={() => setPay({ kind: "card", cardId: c.id })}
                />
              ))}
              <MethodRow label="🟠  Idram" selected={pay.kind === "idram"} onPress={() => setPay({ kind: "idram" })} />
              <Pressable onPress={() => router.push("/cards")}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600", paddingVertical: 6 }}>{t("addCard")}</Text>
              </Pressable>
            </View>
          </>
        )}

        <Button title={payTitle} onPress={submit} disabled={!canPay} loading={busy} />
      </ScrollView>
    </>
  );
}

const isFree = (c: Connector) => c.status === "Available" && !c.busy;

function ConnectorRow({ c, selected, onPress }: { c: Connector; selected: boolean; onPress: () => void }) {
  const { t } = useT();
  const free = isFree(c);
  const label = free ? t("free") : c.busy || c.status === "Charging" || c.status === "Preparing" ? t("busy") : t("unavailable");
  return (
    <Pressable onPress={onPress} style={[s.row, selected && s.rowOn, !free && { opacity: 0.55 }]}>
      <View>
        <Text style={s.text}>{t("connector")} {c.id} · {c.type}</Text>
        <Text style={s.muted}>{c.maxKw} {t("kw")}</Text>
      </View>
      <Text style={{ color: free ? colors.primary : colors.muted, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function MethodRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.row, selected && s.rowOn]}>
      <Text style={s.text}>{label}</Text>
      <View style={[s.radio, selected && { borderColor: colors.primary, borderWidth: 7 }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: "700", color: colors.text },
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 4 },
  text: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16,
    borderRadius: 14, backgroundColor: colors.card, borderWidth: 2, borderColor: "transparent",
  },
  rowOn: { borderColor: colors.primary },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preset: { flexGrow: 1, flexBasis: "45%", padding: 14, borderRadius: 14, backgroundColor: colors.card, alignItems: "center" },
  presetOn: { backgroundColor: colors.primary },
  presetText: { fontSize: 17, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 17,
    color: colors.text, backgroundColor: colors.card,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
});
