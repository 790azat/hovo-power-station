// Browser version: payment page in an iframe. The Pay screen polls the order, so it moves on by itself
// once the server confirms the payment; "Done" lets the user leave the page manually.
import { View } from "react-native";
import { DemoPayPage } from "./DemoPayPage";
import { Button } from "./ui";

export function PayWebView({ url, onResult }: { url: string; onResult: (ok: boolean) => void }) {
  if (url.startsWith("demo:")) return <DemoPayPage url={url} onResult={onResult} />;
  return (
    <View style={{ flex: 1 }}>
      <iframe src={url} style={{ flex: 1, border: 0, width: "100%", height: "100%" }} />
      <View style={{ padding: 12 }}>
        <Button title="OK" onPress={() => onResult(true)} />
      </View>
    </View>
  );
}
