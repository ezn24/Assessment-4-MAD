const appJson = require("./app.json");
require("dotenv").config();

const expoConfig = appJson.expo;
const existingPlugins = expoConfig.plugins || [];
const existingAndroid = expoConfig.android || {};
const existingPermissions = existingAndroid.permissions || [];

const adMobPlugin = [
  "react-native-google-mobile-ads",
  {
    // Google official test IDs. Replace with production IDs before store release.
    androidAppId: "ca-app-pub-3940256099942544~3347511713",
    iosAppId: "ca-app-pub-3940256099942544~1458002511",
    delayAppMeasurementInit: true,
    userTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you."
  }
];

module.exports = {
  ...expoConfig,
  plugins: [
    ...existingPlugins.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== "react-native-google-mobile-ads";
    }),
    adMobPlugin
  ],
  android: {
    ...existingAndroid,
    permissions: Array.from(new Set([
      ...existingPermissions,
      "ACCESS_WIFI_STATE",
      "WRITE_EXTERNAL_STORAGE",
      "RECEIVE_BOOT_COMPLETED",
      "RECORD_AUDIO",
      "USE_EXACT_ALARM",
      "SYSTEM_ALERT_WINDOW",
      "VIBRATE"
    ]))
  },
  extra: {
    ...expoConfig.extra,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || expoConfig.extra.firebaseApiKey,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || expoConfig.extra.firebaseAuthDomain,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || expoConfig.extra.firebaseProjectId,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || expoConfig.extra.firebaseStorageBucket,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || expoConfig.extra.firebaseMessagingSenderId,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || expoConfig.extra.firebaseAppId,
    eas: {
      projectId: "a2ba39a0-1bc0-4653-b90a-501239ec5cb4"
    }
  }
};
