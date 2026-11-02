// Circular charge progress ring, like the app icon.
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import type { ReactNode } from "react";
import { colors } from "../lib/theme";

export function ChargeRing({ progress, size = 260, stroke = 18, children }: {
  progress: number; size?: number; stroke?: number; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0.005, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#5fd9a8" />
            <Stop offset="0.5" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.primary2} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke="url(#g)" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${c * p} ${c}`}
        />
      </Svg>
      {children}
    </View>
  );
}
