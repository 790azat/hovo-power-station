// Web map (browser / iPhone home-screen version) using Leaflet + OpenStreetMap tiles.
import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Station } from "../lib/api";
import { markerColor, st, YEREVAN, type StationMapProps } from "./StationMap.shared";

export { YEREVAN, markerColor };

const icon = (s: Station, selected: boolean) => {
  const size = selected ? 46 : 38;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${markerColor(s)};border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:${selected ? 22 : 18}px;box-sizing:border-box">⚡</div>`,
  });
};

export function StationMap({ stations, selectedId, onSelect, locateBottom }: StationMapProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([YEREVAN.latitude, YEREVAN.longitude], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    m.on("click", () => onSelectRef.current(null));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 100);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const s of stations) {
      if (s.lat == null || s.lng == null) continue;
      L.marker([s.lat, s.lng], { icon: icon(s, s.id === selectedId), zIndexOffset: s.id === selectedId ? 1000 : 0 })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(s);
        })
        .addTo(g);
    }
  }, [stations, selectedId]);

  const locate = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      map.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 14);
      L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 8, color: "#fff", fillColor: "#2563eb", fillOpacity: 1, weight: 3 }).addTo(map.current!);
    });
  };

  return (
    <>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <div ref={el} style={{ width: "100%", height: "100%" }} />
      </View>
      <Pressable style={[st.locate, { bottom: locateBottom }]} onPress={locate}>
        <Text style={{ fontSize: 20 }}>📍</Text>
      </Pressable>
    </>
  );
}
