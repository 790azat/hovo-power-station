import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api, type Session } from "../lib/api";
import { useT, type Key } from "../lib/i18n";
import { amd, colors } from "../lib/theme";
import { Card } from "../components/ui";

export default function History() {
  const { t } = useT();
  const [items, setItems] = useState<Session[]>([]);
  useFocusEffect(useCallback(() => { api.history().then(setItems).catch(() => {}); }, []));

  return (
    <FlatList
      data={items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      ListHeaderComponent={
        <Pressable onPress={() => router.push("/cards")}>
          <Card style={s.row}>
            <Text style={s.title}>💳  {t("myCards")}</Text>
            <Text style={s.muted}>›</Text>
          </Card>
        </Pressable>
      }
      ListEmptyComponent={<Text style={[s.muted, { textAlign: "center", marginTop: 24 }]}>{t("noHistory")}</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/session/${item.id}`)}>
          <Card style={s.row}>
            <View style={{ gap: 2 }}>
              <Text style={s.title}>{item.stationName} · {t("connector")} {item.connectorId}</Text>
              <Text style={s.muted}>
                {new Date(item.createdAt.replace(" ", "T") + "Z").toLocaleString()} · {t(("st_" + item.status) as Key)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.title}>{amd(item.cost)}</Text>
              <Text style={s.muted}>{item.energyKwh.toFixed(2)} {t("kwh")}</Text>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "600", color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
});
