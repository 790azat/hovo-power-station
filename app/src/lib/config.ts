import Constants from "expo-constants";

// Server address. Change "extra.apiUrl" in app.json (or set EXPO_PUBLIC_API_URL) to your server.
// On a real phone "localhost" is the phone itself — use your computer's LAN IP or the deployed URL.
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:8080";
