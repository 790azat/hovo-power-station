import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors } from "../lib/theme";

export function Button({ title, onPress, disabled, loading, variant = "primary", style }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: "primary" | "secondary" | "danger"; style?: ViewStyle;
}) {
  const bg = variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : colors.card;
  const fg = variant === "secondary" ? colors.text : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "secondary" && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={s.center}>{children}</View>;
}

const s = StyleSheet.create({
  btn: { minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnText: { fontSize: 17, fontWeight: "600" },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
});
