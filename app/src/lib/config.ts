import Constants from "expo-constants";

// Server address. Change "extra.apiUrl" in app.json (or set EXPO_PUBLIC_API_URL) to your server.
// On a real phone "localhost" is the phone itself — use your computer's LAN IP or the deployed URL.
// EXPO_PUBLIC_API_URL=same-origin: the web app is served by the server itself, so use relative URLs.
const envUrl = process.env.EXPO_PUBLIC_API_URL;
export const API_URL: string =
  envUrl === "same-origin" ? "" : envUrl || (Constants.expoConfig?.extra?.apiUrl as string) || "http://localhost:8080";

// EXPO_PUBLIC_DEMO=1: no server needed, stations/payments/charging are simulated in the app.
export const DEMO = process.env.EXPO_PUBLIC_DEMO === "1";
