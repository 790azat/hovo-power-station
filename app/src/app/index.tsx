// Home: map with all stations + balance, active charging and QR scan.
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Me, type Station } from "../lib/api";
import { useT, type Lang } from "../lib/i18n";
import { amd, colors } from "../lib/theme";
import { Button, Card } from "../components/ui";
import { StationMap } from "../components/StationMap";

export default function Home() {
  const { t, lang, setLang } = useT();
  const insets = useSafeAreaInsets();
  const [stations, setStations] = useState<Station[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<Station | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.stations().then((list) => {
      setStations(list);
      setError(null);
      setSelected((cur) => (cur ? list.find((s) => s.id === cur.id) ?? null : null));
    }).catch(() => setError(t("err_network")));
    api.me().then(setMe).catch(() => {});
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 15000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const active = me?.active[0];
  const langs: Lang[] = ["hy", "ru", "en"];

  return (
    <View style={{ flex: 1 }}>
      <StationMap
        stations={stations}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        locateBottom={(selected ? 250 : 230) + insets.bottom}
      />

      {/* Top bar: balance + language + history */}
      <View style={[st.top, { paddingTop: insets.top + 8 }]}>
        <Card style={st.topCard}>
          <View>
            <Text style={st.muted}>{t("balance")}</Text>
            <Text style={st.balance}>{amd(me?.balance ?? 0)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {langs.map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[st.lang, lang === l && st.langActive]}>
                <Text style={[st.langText, lang === l && { color: "#fff" }]}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push("/history")} style={st.lang}>
              <Text style={st.langText}>🕘</Text>
            </Pressable>
          </View>
        </Card>
        {active && (
          <Pressable onPress={() => router.push(`/session/${active.id}`)}>
            <Card style={[st.topCard, { backgroundColor: colors.primary }]}>
              <Text style={st.activeText}>⚡ {t("activeCharging")} · {active.energyKwh.toFixed(2)} {t("kwh")}</Text>
              <Text style={st.activeText}>›</Text>
            </Card>
          </Pressable>
        )}
        {error && <Card style={st.topCard}><Text style={{ color: colors.danger }}>{error}</Text></Card>}
      </View>

      {/* Bottom panel */}
      <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {selected ? (
          <Card style={{ gap: 10 }}>
            <Text style={st.title}>{selected.name}</Text>
            {!!selected.address && <Text style={st.muted}>{selected.address}</Text>}
            <Text style={st.text}>
              {selected.online
                ? `${selected.freeConnectors}/${selected.connectors.length} ${t("freeOf")} · ${selected.pricePerKwh} ${t("perKwh")}`
                : t("offline")}
            </Text>
            <Button title={t("select")} onPress={() => router.push(`/station/${encodeURIComponent(selected.id)}`)} />
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <Button title={`📷  ${t("scanQr")}`} onPress={() => router.push("/scan")} />
            <Text style={[st.muted, { textAlign: "center" }]}>{t("orEnterCode")}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="HOVO-001"
                autoCapitalize="characters"
                autoCorrect={false}
                style={st.input}
                onSubmitEditing={() => code.trim() && router.push(`/station/${encodeURIComponent(code.trim())}`)}
              />
              <Button
                title={t("open")}
                variant="secondary"
                disabled={!code.trim()}
                onPress={() => router.push(`/station/${encodeURIComponent(code.trim())}`)}
              />
            </View>
          </Card>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { position: "absolute", left: 12, right: 12, gap: 8 },
  topCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 0 },
  muted: { color: colors.muted, fontSize: 13 },
  text: { color: colors.text, fontSize: 15 },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  balance: { color: colors.text, fontSize: 20, fontWeight: "700" },
  lang: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg },
  langActive: { backgroundColor: colors.text },
  langText: { fontSize: 13, fontWeight: "600", color: colors.text },
  activeText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  input: {
    flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14,
    fontSize: 17, color: colors.text, backgroundColor: colors.bg,
  },
});
