// Hovo design tokens — dark "charged" theme matching the app icon.
export const colors = {
  bg: "#06120c",
  bgElevated: "#0a1a12",
  card: "#0f2219",
  card2: "#14301f",
  glass: "rgba(10, 26, 18, 0.86)",
  border: "rgba(163, 247, 90, 0.10)",
  borderStrong: "rgba(163, 247, 90, 0.28)",
  text: "#ecfdf3",
  muted: "#8aa999",
  faint: "#4d6b5b",
  primary: "#a3f75a", // lime (icon bolt)
  primary2: "#22c55e", // green
  onPrimary: "#05170c",
  primarySoft: "rgba(163, 247, 90, 0.12)",
  warn: "#fbbf24",
  warnSoft: "rgba(251, 191, 36, 0.14)",
  danger: "#f87171",
  dangerSoft: "rgba(248, 113, 113, 0.14)",
  offline: "#5f7368",
  offlineSoft: "rgba(95, 115, 104, 0.2)",
};

export const gradients = {
  primary: ["#d9ff7a", "#a3f75a", "#22c55e"] as const,
  hero: ["#16402b", "#0b2116", "#07140d"] as const,
  danger: ["#fb8a8a", "#ef4444"] as const,
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
