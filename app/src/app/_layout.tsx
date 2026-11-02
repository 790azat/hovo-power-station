import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LangProvider, useT } from "../lib/i18n";
import { colors } from "../lib/theme";

function Nav() {
  const { t } = useT();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ title: t("scanQr"), presentation: "fullScreenModal", headerShown: false }} />
      <Stack.Screen name="station/[id]" options={{ title: t("station") }} />
      <Stack.Screen name="pay/[orderId]" options={{ title: t("payment"), gestureEnabled: false }} />
      <Stack.Screen name="session/[id]" options={{ title: t("session"), headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="history" options={{ title: t("history") }} />
      <Stack.Screen name="cards" options={{ title: t("myCards") }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <StatusBar style="dark" />
        <Nav />
      </LangProvider>
    </SafeAreaProvider>
  );
}
