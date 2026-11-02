// Idram mark for the payment method list.
// TODO: replace with the official Idram logo file from Idram's merchant brand kit (assets/idram.png).
import { Text, View } from "react-native";

export function IdramBadge({ size = 42 }: { size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.3, backgroundColor: "#ff6a00",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.27, letterSpacing: -0.3 }}>Idram</Text>
    </View>
  );
}
