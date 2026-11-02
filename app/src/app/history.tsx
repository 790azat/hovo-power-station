import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api, type Session } from "../lib/api";
import { useT, type Key } from "../lib/i18n";
import { amd, colors, font, radius } from "../lib/theme";
import { Card, Chip, Label } from "../components/ui";

export default function History() {
  const { t } = useT();
  const [items, setItems] = useState<Session[]>([]);
  const [balance, setBalance] = useState(0);
  useFocusEffect(useCallback(() => {
    api.history().then(setItems).catch(() => {});
    api.me().then((m) => setBalance(m.balance)).catch(() => {});
  }, []));

  const totalKwh = items.reduce((a, s) => a + s.energyKwh, 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Card glow style={{ flex: 1, gap: 4 }}>
              <Label>{t("balance")}</Label>
              <Text style={s.big}>{amd(balance)}</Text>
            </Card>
            <Card style={{ flex: 1, gap: 4 }}>
              <Label>{t("energy")}</Label>
              <Text style={s.big}>{totalKwh.toFixed(1)} <Text style={font.small}>{t("kwh")}</Text></Text>
            </Card>
          </View>
          <Pressable onPress={() => router.push("/cards")} style={s.cardsRow}>
            <Text style={{ fontSize: 20 }}>💳</Text>
            <Text style={[s.title, { flex: 1 }]}>{t("myCards")}</Text>
            <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
          </Pressable>
          <Label style={{ marginTop: 8 }}>{t("history")}</Label>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: "center", gap: 10, marginTop: 30 }}>
          <Text style={{ fontSize: 44 }}>🔋</Text>
          <Text style={font.small}>{t("noHistory")}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const tone = item.status === "failed" ? "danger" : item.status === "finished" ? "offline" : "primary";
        return (
          <Pressable onPress={() => router.push(`/session/${item.id}`)}>
            <Card style={s.row}>
              <View style={s.icon}><Text style={{ fontSize: 18 }}>⚡</Text></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.title} numberOfLines={1}>{item.stationName}</Text>
                <Text style={font.small}>
                  {new Date(item.createdAt.replace(" ", "T") + (item.createdAt.includes("Z") ? "" : "Z")).toLocaleDateString()} · {t("connector")} {item.connectorId}
                </Text>
                <Chip text={t(("st_" + item.status) as Key)} tone={tone} />
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={s.title}>{amd(item.cost)}</Text>
                <Text style={font.small}>{item.energyKwh.toFixed(2)} {t("kwh")}</Text>
              </View>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  big: { fontSize: 22, fontWeight: "900", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardsRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
});
