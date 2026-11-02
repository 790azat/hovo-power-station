// Open a route to the station in Yandex Navigator; fall back to Yandex Maps app, then Yandex Maps website.
import { Linking, Platform } from "react-native";

export async function openRoute(lat: number, lng: number) {
  const navi = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`;
  const mapsApp = `yandexmaps://maps.yandex.ru/?rtext=~${lat},${lng}&rtt=auto`;
  const web = `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`;

  if (Platform.OS === "web") {
    // Try the app; if the page is still visible after a moment, the app isn't installed -> website.
    const timer = setTimeout(() => {
      if (!document.hidden) window.location.href = web;
    }, 1500);
    document.addEventListener("visibilitychange", () => document.hidden && clearTimeout(timer), { once: true });
    window.location.href = navi;
    return;
  }
  for (const url of [navi, mapsApp]) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // not installed, try the next one
    }
  }
  await Linking.openURL(web);
}
