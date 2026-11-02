// Fake Idram / bank page used in DEMO mode.
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { demoPay } from "../lib/demo";
import { amd, colors } from "../lib/theme";
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
  return (
    <View style={s.wrap}>
      <Text style={s.badge}>DEMO</Text>
      <Text style={[s.brand, { color: isCard ? "#1d4ed8" : "#f97316" }]}>{info?.title ?? "Payment"}</Text>
      <Text style={s.amount}>{amd(info?.amount ?? 0)}</Text>
      {isCard && (
        <TextInput value={pan} onChangeText={setPan} keyboardType="number-pad" style={s.input} placeholder="Card number" />
      )}
      <Button title={isCard ? "Pay" : "Pay with Idram"} onPress={() => finish(true)} loading={busy} style={{ alignSelf: "stretch" }} />
      <Button title="Cancel" variant="secondary" onPress={() => finish(false)} disabled={busy} style={{ alignSelf: "stretch" }} />
      <Text style={s.note}>Test mode: no real money is charged.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14, backgroundColor: "#fff" },
  badge: { backgroundColor: colors.warn, color: "#fff", fontWeight: "700", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  brand: { fontSize: 30, fontWeight: "800" },
  amount: { fontSize: 40, fontWeight: "700", color: colors.text },
  input: { alignSelf: "stretch", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 18 },
  note: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
