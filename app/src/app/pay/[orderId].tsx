// Payment page (Idram or bank 3-D Secure). After payment we wait for the server to confirm and open the session.
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import { notify } from "../../lib/alert";
import { useT } from "../../lib/i18n";
import { colors } from "../../lib/theme";
import { Center } from "../../components/ui";
import { PayWebView } from "../../components/PayWebView";

export default function Pay() {
  const { orderId, url } = useLocalSearchParams<{ orderId: string; url: string }>();
  const { t } = useT();
  const [waiting, setWaiting] = useState(false);

  // Poll the order: the payment confirmation arrives server-to-server, sometimes before the redirect.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const o = await api.order(Number(orderId));
        if (o.sessionId) {
          stop = true;
          return router.replace(`/session/${o.sessionId}`);
        }
        if (o.status === "failed") {
          stop = true;
          notify(t("paymentCancelled"));
          return router.back();
        }
      } catch {}
      setTimeout(tick, 2000);
    };
    const first = setTimeout(tick, 2000);
    return () => {
      stop = true;
      clearTimeout(first);
    };
  }, [orderId, t]);

  if (waiting) {
    return (
      <Center>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: 17, textAlign: "center", color: colors.text }}>{t("waitingPayment")}</Text>
      </Center>
    );
  }

  return (
    <PayWebView
      url={url}
      onResult={(ok) => {
        if (ok) setWaiting(true);
        else {
          notify(t("paymentCancelled"));
          router.back();
        }
      }}
    />
  );
}
