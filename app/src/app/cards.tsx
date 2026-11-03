// Saved bank cards: add (opens the bank page) and remove.
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api, ApiError, type SavedCard } from "../lib/api";
import { errorText, useT } from "../lib/i18n";
import { colors, font, radius } from "../lib/theme";
import { Button } from "../components/ui";
import { PayWebView } from "../components/PayWebView";
import { confirm, notify } from "../lib/alert";

const CARD_GRADIENTS = [
  ["#2a3038", "#16191e"],
  ["#1f3b5c", "#121c2b"],
  ["#1d4a3b", "#11241e"],
] as const;

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
      notify(errorText(t, e instanceof ApiError ? e.code : "generic"));
    } finally {
      setBusy(false);
    }
  };

  const remove = (c: SavedCard) =>
    confirm(t("deleteCard"), c.maskedPan ?? "", t("yes"), t("no"), () => api.deleteCard(c.id).then(load));

  if (linking) {
    return (
      <>
        <Stack.Screen options={{ title: t("addCard").replace("+ ", "") }} />
        <PayWebView
          url={linking.formUrl}
          onResult={async (ok) => {
            const st = await api.cardStatus(linking.cardId).catch(() => null);
            notify(ok && st?.status === "active" ? t("cardLinked") : t("cardFailed"));
            setLinking(null);
            load();
          }}
        />
      </>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Stack.Screen options={{ title: t("myCards") }} />
      {cards.length === 0 && (
        <View style={{ alignItems: "center", gap: 10, marginVertical: 20 }}>
          <Text style={{ fontSize: 44 }}>💳</Text>
          <Text style={font.small}>{t("noCards")}</Text>
        </View>
      )}
      {cards.map((c, i) => (
        <LinearGradient key={c.id} colors={CARD_GRADIENTS[i % CARD_GRADIENTS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bankCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={s.chipIcon} />
            <Pressable onPress={() => remove(c)} hitSlop={12} style={s.del}>
              <Text style={{ color: "#fff", fontSize: 14 }}>✕</Text>
            </Pressable>
          </View>
          <Text style={s.pan}>{c.maskedPan}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.small}>HOVO POWER</Text>
            <Text style={s.small}>{c.expiry ?? ""}</Text>
          </View>
        </LinearGradient>
      ))}
      <Button title={t("addCard").replace("+ ", "")} icon="+" onPress={add} loading={busy} />
      <Text style={[font.small, { textAlign: "center" }]}>{t("cardNote")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bankCard: { borderRadius: radius.lg, padding: 20, gap: 22, aspectRatio: 1.7, justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  chipIcon: { width: 42, height: 30, borderRadius: 6, backgroundColor: "#e5c86b" },
  del: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  pan: { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: 2 },
  small: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
});
