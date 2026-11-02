// Browser version: payment pages (Idram / bank) can't run inside an iframe, so the whole page
// goes to the payment site; afterwards the server's success page brings the user back to the app,
// where the active charging session is shown on the home screen.
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { DemoPayPage } from "./DemoPayPage";
import { colors } from "../lib/theme";

export function PayWebView({ url, onResult }: { url: string; onResult: (ok: boolean) => void }) {
  const demo = url.startsWith("demo:");
  useEffect(() => {
    if (!demo) window.location.href = url;
  }, [url, demo]);
  if (demo) return <DemoPayPage url={url} onResult={onResult} />;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
