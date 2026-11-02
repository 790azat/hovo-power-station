// Saved bank cards: add (opens the bank page) and remove.
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { api, ApiError, type SavedCard } from "../lib/api";
import { errorText, useT } from "../lib/i18n";
import { colors } from "../lib/theme";
import { Button, Card } from "../components/ui";
import { PayWebView } from "../components/PayWebView";

export default function Cards() {
  const { t } = useT();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [linking, setLinking] = useState<{ cardId: string; formUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.cards().then(setCards).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => load(), [load]));

  const add = async () => {
    setBusy(true);
    try {
      setLinking(await api.linkCard());
    } catch (e) {
      Alert.alert(errorText(t, e instanceof ApiError ? e.code : "generic"));
    } finally {
      setBusy(false);
    }
  };

  const remove = (c: SavedCard) =>
    Alert.alert(t("deleteCard"), c.maskedPan ?? "", [
      { text: t("no"), style: "cancel" },
      { text: t("yes"), style: "destructive", onPress: () => api.deleteCard(c.id).then(load) },
    ]);

  if (linking) {
    return (
      <>
        <Stack.Screen options={{ title: t("addCard").replace("+ ", "") }} />
        <PayWebView
          url={linking.formUrl}
          onResult={async (ok) => {
            const st = await api.cardStatus(linking.cardId).catch(() => null);
            Alert.alert(ok && st?.status === "active" ? t("cardLinked") : t("cardFailed"));
            setLinking(null);
            load();
          }}
        />
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: t("myCards") }} />
      {cards.length === 0 && <Text style={s.muted}>{t("noCards")}</Text>}
      {cards.map((c) => (
        <Card key={c.id} style={s.row}>
          <Text style={s.text}>💳  {c.maskedPan}</Text>
          <Pressable onPress={() => remove(c)} hitSlop={12}>
            <Text style={{ color: colors.danger, fontSize: 20 }}>✕</Text>
          </Pressable>
        </Card>
      ))}
      <Button title={t("addCard")} onPress={add} loading={busy} />
      <Text style={s.muted}>{t("cardNote")}</Text>
      <View style={{ height: 8 }} />
      <Text style={s.muted}>Idram: {t("payIdram")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  text: { fontSize: 17, color: colors.text },
  muted: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
