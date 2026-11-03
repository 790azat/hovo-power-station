// Animated logo intro shown when the app starts: the charge ring fills, the bolt strikes in,
// the wordmark slides up, then everything fades into the app.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../lib/theme";

const SIZE = 180;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const BOLT = "M566 214 L346 560 L494 560 L452 810 L690 438 L540 438 Z"; // same path as the app icon (1024 grid)

export function Intro({ onDone }: { onDone: () => void }) {
  const ring = useRef(new Animated.Value(0)).current;
  const bolt = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const [ringP, setRingP] = useState(0);

  useEffect(() => {
    const id = ring.addListener(({ value }) => setRingP(value));
    Animated.sequence([
      Animated.timing(ring, { toValue: 0.8, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.parallel([
        Animated.spring(bolt, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
        Animated.timing(ring, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.timing(word, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(550),
      Animated.timing(out, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone());
    return () => ring.removeListener(id);
  }, []);

  const boltScale = bolt.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const wordY = word.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const outScale = out.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: out }]} pointerEvents="none">
      <Animated.View style={[s.flash, { opacity: flash }]} />
      <Animated.View style={{ alignItems: "center", transform: [{ scale: outScale }] }}>
        <View style={s.logo}>
          <View style={s.glow} />
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
            <Defs>
              <LinearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.primary2} />
                <Stop offset="1" stopColor="#5fd9a8" />
              </LinearGradient>
            </Defs>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="url(#ig)" strokeWidth={STROKE} fill="none" strokeLinecap="round"
              strokeDasharray={`${Math.max(0.001, ringP) * C} ${C}`}
            />
          </Svg>
          <Animated.View style={{ opacity: bolt, transform: [{ scale: boltScale }] }}>
            <Svg width={SIZE * 0.54} height={SIZE * 0.54} viewBox="300 180 430 670">
              <Defs>
                <LinearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
                  <Stop offset="0" stopColor="#ffffff" />
                  <Stop offset="1" stopColor="#e3e7ec" />
                </LinearGradient>
              </Defs>
              <Path d={BOLT} fill="url(#bg)" stroke="none" strokeWidth={0} strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: word, transform: [{ translateY: wordY }], alignItems: "center", marginTop: 34 }}>
          <Text style={s.word}>
            HOVO<Text style={{ color: colors.primary }}> POWER</Text>
          </Text>
          <Text style={s.tag}>EV CHARGING · ARMENIA</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", zIndex: 100 },
  flash: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.05)" },
  logo: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute", width: SIZE * 0.8, height: SIZE * 0.8, borderRadius: SIZE, backgroundColor: colors.primary,
    opacity: 0.0,
  },
  word: { fontSize: 30, fontWeight: "900", letterSpacing: 4, color: colors.text },
  tag: { fontSize: 11, fontWeight: "700", letterSpacing: 3, color: colors.muted, marginTop: 8 },
});
