// Fake Idram / bank page used in DEMO mode.
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { demoPay } from "../lib/demo";
import { amd, colors, font, radius } from "../lib/theme";
import { Button } from "./ui";

export function DemoPayPage({ url, onResult }: { url: string; onResult: (ok: boolean) => void }) {
  const info = demoPay.describe(url);
  const isCard = !url.startsWith("demo:idram");
  const [pan, setPan] = useState("4111 1111 1111 1111");
  const [busy, setBusy] = useState(false);
  const finish = async (ok: boolean) => {
    setBusy(true);
    await demoPay.complete(url, ok, pan);
    onResult(ok);
  };
  const brand = isCard ? "#3b82f6" : "#f97316";
  return (
    <View style={s.wrap}>
      <View style={s.panel}>
        <Text style={s.badge}>DEMO</Text>
        <View style={[s.logo, { backgroundColor: brand }]}>
          <Text style={s.logoText}>{isCard ? "💳" : "i"}</Text>
        </View>
        <Text style={[font.h2, { color: brand }]}>{info?.title ?? "Payment"}</Text>
        <Text style={s.amount}>{amd(info?.amount ?? 0)}</Text>
        {isCard && (
          <TextInput value={pan} onChangeText={setPan} keyboardType="number-pad" style={s.input} placeholderTextColor={colors.faint} placeholder="Card number" />
        )}
        <Button title={isCard ? "Pay" : "Pay with Idram"} onPress={() => finish(true)} loading={busy} style={{ alignSelf: "stretch" }} />
        <Button title="Cancel" variant="ghost" onPress={() => finish(false)} disabled={busy} style={{ alignSelf: "stretch" }} />
        <Text style={[font.small, { textAlign: "center" }]}>Test mode: no real money is charged.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: colors.bg },
  panel: { alignItems: "center", gap: 14, padding: 24, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badge: { backgroundColor: colors.warnSoft, color: colors.warn, fontWeight: "800", fontSize: 12, letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 30, color: "#fff", fontWeight: "900" },
  amount: { fontSize: 42, fontWeight: "900", color: colors.text, letterSpacing: -1 },
  input: { alignSelf: "stretch", height: 54, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, fontSize: 18, color: colors.text, backgroundColor: colors.bg },
});
