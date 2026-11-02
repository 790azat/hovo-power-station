// Adds settings that come from environment variables on top of app.json.
//   GOOGLE_MAPS_ANDROID_KEY  – required for the map on Android release builds
//   EXPO_PUBLIC_API_URL      – server address (read in src/lib/config.ts)
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ["react-native-maps", { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY }],
    ["expo-location", { locationWhenInUsePermission: "Location is used to show charging stations near you." }],
  ],
});
