// Native map (Apple Maps on iOS, Google Maps on Android). The web version is StationMap.web.tsx.
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

import { darkMapStyle, markerColor, st, YEREVAN, type StationMapProps } from "./StationMap.shared";

export { YEREVAN, markerColor };

export function StationMap({ stations, selectedId, onSelect, locateBottom }: StationMapProps) {
  const map = useRef<MapView>(null);
  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    map.current?.animateToRegion({
      latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05,
    });
  };
  return (
    <>
      <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={YEREVAN} showsUserLocation customMapStyle={darkMapStyle} userInterfaceStyle="dark" onPress={() => onSelect(null)}>
        {stations.filter((s) => s.lat != null && s.lng != null).map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            onPress={(e) => {
              e.stopPropagation();
              onSelect(s);
            }}
          >
            <View style={[st.pinHalo, { backgroundColor: markerColor(s) + "26" }, selectedId === s.id && st.pinSelected]}>
              <View style={[st.pin, { backgroundColor: markerColor(s) }]}>
                <Text style={st.pinText}>⚡</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
      <Pressable style={[st.locate, { bottom: locateBottom }]} onPress={locate}>
        <Text style={{ fontSize: 20, color: "#3ccb91" }}>➤</Text>
      </Pressable>
    </>
  );
}

