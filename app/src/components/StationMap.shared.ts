import { StyleSheet } from "react-native";
import type { Station } from "../lib/api";
import { colors } from "../lib/theme";

export type StationMapProps = {
  stations: Station[];
  selectedId: string | null;
  onSelect: (s: Station | null) => void;
  locateBottom: number;
};

export const YEREVAN = { latitude: 40.1952, longitude: 44.5026, latitudeDelta: 0.11, longitudeDelta: 0.11 };
export const markerColor = (s: Station) =>
  !s.online ? colors.offline : s.freeConnectors > 0 ? colors.primary : colors.warn;

// Dark style for Google Maps on Android (iOS Apple Maps follows the dark appearance automatically)
export const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#121417" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7d848e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0f12" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#22262c" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2f36" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1218" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export const st = StyleSheet.create({
  pinHalo: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  pin: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0d0f12" },
  pinSelected: { transform: [{ scale: 1.2 }] },
  pinText: { fontSize: 16, color: "#0d0f12", fontWeight: "900" },
  locate: {
    position: "absolute", right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center",
  },
});
