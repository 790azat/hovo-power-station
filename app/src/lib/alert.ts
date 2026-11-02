// Alert.alert does nothing in the browser, so use window.alert/confirm there.
import { Alert, Platform } from "react-native";

export function notify(title: string, message = "") {
  if (Platform.OS === "web") window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirm(title: string, message: string, yes: string, no: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: no, style: "cancel" },
    { text: yes, style: "destructive", onPress: onYes },
  ]);
}
