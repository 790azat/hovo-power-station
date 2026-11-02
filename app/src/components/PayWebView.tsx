// Opens a payment page (Idram or bank) and reports when it finishes.
import { useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { colors } from "../lib/theme";
import { DemoPayPage } from "./DemoPayPage";

export function PayWebView({ url, onResult }: { url: string; onResult: (ok: boolean) => void }) {
  const finished = useRef(false);
  if (url.startsWith("demo:")) return <DemoPayPage url={url} onResult={onResult} />;
  const onNav = (nav: WebViewNavigation) => {
    if (finished.current) return;
    const u = nav.url;
    let ok: boolean | null = null;
    if (u.includes("/idram/success")) ok = true;
    else if (u.includes("/idram/fail")) ok = false;
    else if (u.includes("/card/done")) ok = u.includes("ok=1");
    if (ok !== null) {
      finished.current = true;
      onResult(ok);
    }
  };
  return (
    <WebView
      source={{ uri: url }}
      onNavigationStateChange={onNav}
      startInLoadingState
      renderLoading={() => (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    />
  );
}
