// Live charging session: status, energy, cost, stop.
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError, type Session } from "../../lib/api";
import { errorText, useT, type Key } from "../../lib/i18n";
import { amd, colors } from "../../lib/theme";
import { Button, Card, Center } from "../../components/ui";

const elapsed = (from: string | null, to: string | null) => {
  if (!from) return "0:00";
  const ms = (to ? new Date(to) : new Date()).getTime() - new Date(from).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const [s, setS] = useState<Session | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () => api.session(id).then((x) => alive && setS(x)).catch(() => {});
    tick();
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  if (!s) return <Center><ActivityIndicator color={colors.primary} /></Center>;

  const finished = s.status === "finished" || s.status === "failed";
  const progress = s.budget ? Math.min(1, s.cost / s.budget) : 0;
  const reasonKey = ("reason_" + s.stopReason) as Key;

  const stop = () =>
    Alert.alert(t("stopConfirm"), "", [
      { text: t("no"), style: "cancel" },
      {
        text: t("yes"),
        style: "destructive",
        onPress: async () => {
          setStopping(true);
          try {
            setS(await api.stop(s.id));
          } catch (e) {
            Alert.alert(errorText(t, e instanceof ApiError ? e.code : "generic"));
          } finally {
            setStopping(false);
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
        <Text style={{ fontSize: 48 }}>{s.status === "failed" ? "⚠️" : finished ? "✅" : "⚡"}</Text>
        <Text style={st.status}>{t(("st_" + s.status) as Key)}</Text>
        <Text style={st.muted}>{s.stationName} · {t("connector")} {s.connectorId}</Text>
        {s.status === "starting" && <ActivityIndicator color={colors.primary} />}
        {finished && s.stopReason && reasonKey.startsWith("reason_") && (
          <Text style={st.muted}>{t(reasonKey) ?? ""}</Text>
        )}
      </Card>

      <View style={st.grid}>
        <Stat label={t("energy")} value={`${s.energyKwh.toFixed(2)} ${t("kwh")}`} />
        <Stat label={t("power")} value={`${s.powerKw.toFixed(1)} ${t("kw")}`} />
        <Stat label={t("time")} value={elapsed(s.startedAt, s.stoppedAt)} />
        <Stat label={t("cost")} value={amd(s.cost)} />
      </View>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={st.muted}>{t("cost")}: {amd(s.cost)}</Text>
          <Text style={st.muted}>{t("paid")}: {amd(s.budget)}</Text>
        </View>
        <View style={st.barBg}>
          <View style={[st.bar, { width: `${progress * 100}%` }]} />
        </View>
        {finished && (
          <Text style={[st.text, { fontWeight: "600" }]}>
            {t("returned")}: {amd(s.budget - s.cost)}
          </Text>
        )}
      </Card>

      {finished ? (
        <Button title={t("done")} onPress={() => router.dismissTo("/")} />
      ) : (
        <Button
          title={s.status === "starting" ? t("cancel") : t("stop")}
          variant="danger"
          onPress={stop}
          loading={stopping || s.status === "stopping"}
        />
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, gap: 4 }}>
      <Text style={st.muted}>{label}</Text>
      <Text style={st.value}>{value}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  status: { fontSize: 24, fontWeight: "700", color: colors.text, textAlign: "center" },
  muted: { fontSize: 14, color: colors.muted, textAlign: "center" },
  text: { fontSize: 16, color: colors.text },
  value: { fontSize: 22, fontWeight: "700", color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  barBg: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  bar: { height: 10, backgroundColor: colors.primary },
});
