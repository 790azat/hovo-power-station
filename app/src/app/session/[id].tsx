// Live charging session: big ring, energy, cost, stop.
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError, type Session } from "../../lib/api";
import { errorText, hasKey, useT, type Key } from "../../lib/i18n";
import { amd, colors, font, radius } from "../../lib/theme";
import { Button, Card, Center, Chip } from "../../components/ui";
import { ChargeRing } from "../../components/ChargeRing";
import { confirm, notify } from "../../lib/alert";

const elapsed = (from: string | null, to: string | null) => {
  if (!from) return "0:00";
  const ms = (to ? new Date(to) : new Date()).getTime() - new Date(from).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
};

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<Session | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () => api.session(id).then((x) => alive && setS(x)).catch(() => {});
    tick();
    const timer = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  if (!s) return <Center><ActivityIndicator color={colors.primary} /></Center>;

  const finished = s.status === "finished" || s.status === "failed";
  const progress = s.budget ? s.cost / s.budget : 0;
  const reasonKey = ("reason_" + s.stopReason) as Key;
  const tone = s.status === "failed" ? "danger" : finished ? "primary" : s.status === "starting" ? "warn" : "primary";

  const stop = () =>
    confirm(t("stopConfirm"), "", t("yes"), t("no"), async () => {
      setStopping(true);
      try {
        setS(await api.stop(s.id));
      } catch (e) {
        notify(errorText(t, e instanceof ApiError ? e.code : "generic"));
      } finally {
        setStopping(false);
      }
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, alignItems: "stretch", paddingBottom: 120 + insets.bottom }}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Chip text={t(("st_" + s.status) as Key)} tone={tone} />
          <Text style={font.small}>{s.stationName} · {t("connector")} {s.connectorId}</Text>
        </View>

        <View style={{ alignItems: "center", marginVertical: 6 }}>
          <View style={st.ringGlow} />
          <ChargeRing size={finished ? 220 : 260} progress={finished ? Math.max(progress, 0.005) : progress}>
            {s.status === "starting" ? (
              <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 40 }}>
                <Text style={{ fontSize: 46 }}>🔌</Text>
                <Text style={[font.body, { textAlign: "center", fontWeight: "700" }]}>{t("st_starting")}</Text>
              </View>
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text style={st.big}>{s.energyKwh.toFixed(2)}</Text>
                <Text style={st.unit}>{t("kwh")}</Text>
                <Text style={st.cost}>{amd(s.cost)}</Text>
              </View>
            )}
          </ChargeRing>
        </View>

        {finished && hasKey(reasonKey) && <Text style={[font.small, { textAlign: "center" }]}>{t(reasonKey)}</Text>}

        {finished && (
          <Card glow style={{ alignItems: "center", gap: 4 }}>
            <Text style={font.small}>{t("returned")}</Text>
            <Text style={{ fontSize: 30, fontWeight: "900", color: colors.primary }}>+{amd(s.budget - s.cost)}</Text>
          </Card>
        )}
        <View style={st.grid}>
          <Stat icon="⚡" label={t("power")} value={`${s.powerKw.toFixed(1)} ${t("kw")}`} />
          <Stat icon="⏱" label={t("time")} value={elapsed(s.startedAt, s.stoppedAt)} />
          <Stat icon="֏" label={t("paid")} value={amd(s.budget)} />
        </View>

      </ScrollView>

      <View style={[st.bar, { paddingBottom: insets.bottom + 14 }]}>
        {finished ? (
          <Button title={t("done")} onPress={() => router.dismissTo("/")} />
        ) : (
          <Button
            title={s.status === "starting" ? t("cancel") : t("stop")}
            icon="■"
            variant="danger"
            onPress={stop}
            loading={stopping || s.status === "stopping"}
          />
        )}
      </View>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, gap: 6 }}>
      <Text style={{ color: colors.primary, fontSize: 16 }}>{icon}</Text>
      <Text style={st.statVal} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={font.small}>{label}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  ringGlow: {
    position: "absolute", top: 40, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.primary,
    opacity: 0.08, shadowColor: colors.primary, shadowOpacity: 1, shadowRadius: 60,
  },
  big: { fontSize: 56, fontWeight: "900", color: colors.text, letterSpacing: -2 },
  unit: { fontSize: 15, fontWeight: "700", color: colors.muted, marginTop: -4 },
  cost: { fontSize: 20, fontWeight: "800", color: colors.primary, marginTop: 10 },
  grid: { flexDirection: "row", gap: 10 },
  statVal: { fontSize: 17, fontWeight: "800", color: colors.text },
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: colors.bgElevated, borderTopWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
  },
});
