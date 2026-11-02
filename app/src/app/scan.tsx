import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseStationQr } from "../lib/api";
import { useT } from "../lib/i18n";
import { Button, Center } from "../components/ui";

export default function Scan() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [hint, setHint] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <Center>
        <Text style={{ fontSize: 17, textAlign: "center" }}>{t("cameraNeeded")}</Text>
        <Button title={t("allow")} onPress={requestPermission} />
        <Button title={t("cancel")} variant="secondary" onPress={() => router.back()} />
      </Center>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const parsed = parseStationQr(data);
          if (!parsed) return setHint(t("badQr"));
          handled.current = true;
          const q = parsed.connector ? `?connector=${parsed.connector}` : "";
          router.replace(`/station/${encodeURIComponent(parsed.stationId)}${q}`);
        }}
      />
      <View style={[s.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.hint}>{hint ?? t("pointCamera")}</Text>
        <View style={s.frame} />
        <Pressable onPress={() => router.back()} style={s.close}>
          <Text style={s.closeText}>{t("cancel")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  hint: { color: "#fff", fontSize: 17, fontWeight: "600", textAlign: "center", paddingHorizontal: 24 },
  frame: { width: 250, height: 250, borderWidth: 3, borderColor: "#fff", borderRadius: 24 },
  close: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  closeText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
