// Home: dark map with stations, balance, active charging, QR scan and station sheet.
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Me, type Station } from "../lib/api";
import { useT, type Lang } from "../lib/i18n";
import { amd, colors, font, radius } from "../lib/theme";
import { Button, Chip } from "../components/ui";
import { StationMap } from "../components/StationMap";
import { openRoute } from "../lib/route";

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
  const openStation = (id: string) => router.push(`/station/${encodeURIComponent(id)}`);
  const free = stations.filter((s) => s.online && s.freeConnectors > 0).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StationMap
        stations={stations}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        locateBottom={(selected ? 270 : 250) + insets.bottom}
      />

      {/* top fade so the header reads over the map */}
      <LinearGradient
        colors={["rgba(6,18,12,0.95)", "rgba(6,18,12,0)"]}
        style={[st.topFade, { height: insets.top + 150 }]}
        pointerEvents="none"
      />

      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <View>
            <Text style={st.brand}>
              HOVO<Text style={{ color: colors.primary }}> POWER</Text>
            </Text>
            <Text style={font.small}>{free} {t("freeOf")} · {stations.length} {t("stations").toLowerCase()}</Text>
          </View>
          <View style={st.langs}>
            {langs.map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[st.lang, lang === l && st.langActive]}>
                <Text style={[st.langText, lang === l && { color: colors.onPrimary }]}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable style={[st.glass, { flex: 1 }]} onPress={() => router.push("/history")}>
            <Text style={font.label}>{t("balance")}</Text>
            <Text style={st.balance}>{amd(me?.balance ?? 0)}</Text>
          </Pressable>
          <Pressable style={[st.glass, st.iconBtn]} onPress={() => router.push("/cards")}>
            <Text style={st.iconText}>💳</Text>
          </Pressable>
          <Pressable style={[st.glass, st.iconBtn]} onPress={() => router.push("/history")}>
            <Text style={st.iconText}>🕘</Text>
          </Pressable>
        </View>

        {active && (
          <Pressable onPress={() => router.push(`/session/${active.id}`)}>
            <LinearGradient colors={["#1d5b34", "#123d24"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.activeBar}>
              <View style={st.pulse} />
              <View style={{ flex: 1 }}>
                <Text style={st.activeTitle}>{t("activeCharging")}</Text>
                <Text style={st.activeSub}>{active.stationName} · {active.energyKwh.toFixed(2)} {t("kwh")} · {amd(active.cost)}</Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
            </LinearGradient>
          </Pressable>
        )}
        {error && (
          <View style={[st.glass, { borderColor: colors.danger }]}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </View>
        )}
      </View>

      <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={st.handle} />
        {selected ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={font.h2} numberOfLines={1}>{selected.name}</Text>
                {!!selected.address && <Text style={font.small} numberOfLines={1}>{selected.address}</Text>}
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={12} style={st.close}>
                <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {selected.online ? (
                <Chip
                  tone={selected.freeConnectors > 0 ? "primary" : "warn"}
                  text={`${selected.freeConnectors}/${selected.connectors.length} ${t("freeOf")}`}
                />
              ) : (
                <Chip tone="offline" text={t("offline")} />
              )}
              <Chip tone="offline" text={`${selected.pricePerKwh} ${t("perKwh")}`} />
              <Chip tone="offline" text={`⚡ ${Math.max(...selected.connectors.map((c) => c.maxKw))} ${t("kw")}`} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {selected.lat != null && selected.lng != null && (
                <Button
                  title={t("route")}
                  icon="🧭"
                  variant="secondary"
                  onPress={() => openRoute(selected.lat!, selected.lng!)}
                  style={{ flex: 1 }}
                />
              )}
              <Button title={t("select")} onPress={() => openStation(selected.id)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Button title={t("scanQr")} icon="⌁" onPress={() => router.push("/scan")} />
            <View style={st.codeRow}>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder={t("orEnterCode")}
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                autoCorrect={false}
                style={st.input}
                onSubmitEditing={() => code.trim() && openStation(code.trim())}
              />
              <Pressable
                disabled={!code.trim()}
                onPress={() => openStation(code.trim())}
                style={[st.go, !code.trim() && { opacity: 0.35 }]}
              >
                <Text style={{ color: colors.onPrimary, fontSize: 20, fontWeight: "900" }}>→</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  topFade: { position: "absolute", top: 0, left: 0, right: 0 },
  top: { position: "absolute", left: 16, right: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 22, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  langs: { flexDirection: "row", backgroundColor: colors.glass, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border },
  lang: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  langActive: { backgroundColor: colors.primary },
  langText: { fontSize: 12, fontWeight: "800", color: colors.muted },
  glass: {
    backgroundColor: colors.glass, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  balance: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  iconBtn: { width: 64, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 22 },
  activeBar: {
    flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  pulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 1, shadowRadius: 8 },
  activeTitle: { color: colors.primary, fontWeight: "800", fontSize: 15 },
  activeSub: { color: colors.text, fontSize: 13, marginTop: 2 },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: 18, paddingTop: 10,
    borderTopWidth: 1, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 16,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.faint, marginBottom: 14 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" },
  codeRow: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1, minWidth: 0, height: 54, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16,
    fontSize: 16, color: colors.text, backgroundColor: colors.card,
  },
  go: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
