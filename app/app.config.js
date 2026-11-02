// Adds settings that come from environment variables on top of app.json.
//   GOOGLE_MAPS_ANDROID_KEY  – required for the map on Android release builds
//   EXPO_PUBLIC_API_URL      – server address (read in src/lib/config.ts)
//   EXPO_BASE_URL            – sub-path for the web build, e.g. /hovo-power-station on GitHub Pages
module.exports = ({ config }) => ({
  ...config,
  web: { ...config.web, output: "single", bundler: "metro", name: "Hovo Power", shortName: "Hovo", themeColor: "#16a34a" },
  experiments: { ...(config.experiments ?? {}), baseUrl: process.env.EXPO_BASE_URL || undefined },
  plugins: [
    ...(config.plugins ?? []),
    ["react-native-maps", { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY }],
    ["expo-location", { locationWhenInUsePermission: "Location is used to show charging stations near you." }],
  ],
});
