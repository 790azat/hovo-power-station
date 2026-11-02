import { StyleSheet } from "react-native";
import type { Station } from "../lib/api";
import { colors } from "../lib/theme";

export type StationMapProps = {
  stations: Station[];
  selectedId: string | null;
  onSelect: (s: Station | null) => void;
  locateBottom: number;
};

export const YEREVAN = { latitude: 40.1792, longitude: 44.4991, latitudeDelta: 0.12, longitudeDelta: 0.12 };
export const markerColor = (s: Station) =>
  !s.online ? colors.offline : s.freeConnectors > 0 ? colors.primary : colors.warn;

export const st = StyleSheet.create({
  pin: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  pinSelected: { transform: [{ scale: 1.25 }] },
  pinText: { fontSize: 18 },
  locate: {
    position: "absolute", right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center", elevation: 3,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
});
