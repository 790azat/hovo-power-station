// Idram logo for the payment method list and the payment page.
import { Image, View } from "react-native";

export function IdramBadge({ size = 42 }: { size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.3, backgroundColor: "#ffffff",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Image source={require("../../assets/idram-mark.png")} style={{ width: size * 0.7, height: size * 0.7 }} resizeMode="contain" />
    </View>
  );
}

/** Full "idram" wordmark on a white plate. */
export function IdramLogo({ width = 180 }: { width?: number }) {
  const h = width * (209 / 686);
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
      <Image source={require("../../assets/idram-logo.png")} style={{ width, height: h }} resizeMode="contain" />
    </View>
  );
}
