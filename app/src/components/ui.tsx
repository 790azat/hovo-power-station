import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { colors, font, gradients, radius } from "../lib/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({ title, onPress, disabled, loading, variant = "primary", style, icon }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: Variant; style?: StyleProp<ViewStyle>; icon?: string;
}) {
  const fg = variant === "primary" ? colors.onPrimary : variant === "danger" ? "#fff" : colors.text;
  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <Text style={[s.btnText, { color: fg }]} numberOfLines={1}>
      {icon ? `${icon}  ` : ""}{title}
    </Text>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btnWrap,
        { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === "primary" && s.primaryShadow,
        style,
      ]}
    >
      {variant === "primary" || variant === "danger" ? (
        <LinearGradient
          colors={variant === "primary" ? gradients.primary : gradients.danger}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.btn}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[s.btn, variant === "secondary" ? s.secondary : s.ghost]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, glow }: { children: ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  return <View style={[s.card, glow && s.cardGlow, style]}>{children}</View>;
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={s.center}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[font.label, style]}>{children}</Text>;
}

/** Small colored pill: "Available", "Busy", ... */
export function Chip({ text, tone = "primary" }: { text: string; tone?: "primary" | "warn" | "danger" | "offline" }) {
  const map = {
    primary: [colors.primarySoft, colors.primary],
    warn: [colors.warnSoft, colors.warn],
    danger: [colors.dangerSoft, colors.danger],
    offline: [colors.offlineSoft, colors.muted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <View style={[s.dot, { backgroundColor: fg }]} />
      <Text style={[s.chipText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/** Selectable row/tile with a lime border when selected. */
export function Selectable({ children, selected, onPress, disabled, style }: {
  children: ReactNode; selected?: boolean; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.sel, selected && s.selOn, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }, style]}
    >
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btnWrap: { borderRadius: radius.md },
  btn: { minHeight: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryShadow: {
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  secondary: { backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: "transparent" },
  btnText: { fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border,
  },
  cardGlow: {
    borderColor: colors.borderStrong,
    shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.bg },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  sel: {
    backgroundColor: colors.card, borderRadius: radius.md, padding: 16, borderWidth: 1.5, borderColor: colors.border,
  },
  selOn: { borderColor: colors.primary, backgroundColor: colors.card2 },
});
