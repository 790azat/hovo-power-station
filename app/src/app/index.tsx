// Home: map with all stations + balance, active charging and QR scan.
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Me, type Station } from "../lib/api";
import { useT, type Lang } from "../lib/i18n";
import { amd, colors } from "../lib/theme";
import { Button, Card } from "../components/ui";

const YEREVAN: Region = { latitude: 40.1792, longitude: 44.4991, latitudeDelta: 0.12, longitudeDelta: 0.12 };

const markerColor = (s: Station) => (!s.online ? colors.offline : s.freeConnectors > 0 ? colors.primary : colors.warn);

export default function Home() {
  const { t, lang, setLang } = useT();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
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

  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    map.current?.animateToRegion({ ...YEREVAN, latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  };

  const active = me?.active[0];
  const langs: Lang[] = ["hy", "ru", "en"];

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={YEREVAN}
        showsUserLocation
        onPress={() => setSelected(null)}
      >
        {stations.filter((s) => s.lat != null && s.lng != null).map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            onPress={(e) => {
              e.stopPropagation();
              setSelected(s);
            }}
          >
            <View style={[st.pin, { backgroundColor: markerColor(s) }, selected?.id === s.id && st.pinSelected]}>
              <Text style={st.pinText}>⚡</Text>
            </View>
          </Marker>
        ))}
      </MapView>

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

      <Pressable style={[st.locate, { bottom: (selected ? 330 : 230) + insets.bottom }]} onPress={locate}>
        <Text style={{ fontSize: 20 }}>📍</Text>
      </Pressable>

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
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14,
    fontSize: 17, color: colors.text, backgroundColor: colors.bg,
  },
  pin: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
  },
  pinSelected: { transform: [{ scale: 1.25 }] },
  pinText: { fontSize: 18 },
  locate: {
    position: "absolute", right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center", elevation: 3,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
});
