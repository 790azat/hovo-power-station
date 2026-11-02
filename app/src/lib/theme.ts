// Hovo design tokens: calm graphite dark theme with one emerald accent (no neon).
export const colors = {
  bg: "#0d0f12",
  bgElevated: "#14171b",
  card: "#181b20",
  card2: "#1f2329",
  glass: "rgba(20, 23, 27, 0.92)",
  border: "rgba(255, 255, 255, 0.06)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  text: "#f4f6f8",
  muted: "#8c939d",
  faint: "#4a515b",
  primary: "#3ccb91", // calm emerald accent
  primary2: "#2bb37d",
  onPrimary: "#07130d",
  primarySoft: "rgba(60, 203, 145, 0.12)",
  warn: "#f2b84b",
  warnSoft: "rgba(242, 184, 75, 0.14)",
  danger: "#f26d6d",
  dangerSoft: "rgba(242, 109, 109, 0.14)",
  offline: "#5c636d",
  offlineSoft: "rgba(140, 147, 157, 0.14)",
};

export const gradients = {
  primary: ["#3ccb91", "#33bf88"] as const,
  hero: ["#1c2026", "#15181d"] as const,
  danger: ["#f26d6d", "#e35a5a"] as const,
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 28 };

export const font = {
  h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
  h2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.text },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 1.2, textTransform: "uppercase" as const, color: colors.muted },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
};

export const amd = (n: number) => `${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")} ֏`;
