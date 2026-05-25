require("dotenv").config();

module.exports = {
  name: "VizMinder",
  slug: "vizminder",
  version: "2.0.1",
  assetBundlePatterns: [
    "**/*"
  ],
  plugins: [
    [
      "react-native-google-mobile-ads",
      {
        // Google's official AdMob test App IDs. Replace with real IDs before shipping.
        androidAppId: "ca-app-pub-3940256099942544~3347511713",
        iosAppId: "ca-app-pub-3940256099942544~1458002511",
        delayAppMeasurementInit: true,
        userTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you."
      }
    ]
  ],
  android: {
    package: "com.ezn24.vizminder",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_NETWORK_STATE",
      "ACCESS_WIFI_STATE",
      "CAMERA",
      "FLASHLIGHT",
      "INTERNET",
      "POST_NOTIFICATIONS",
      "READ_EXTERNAL_STORAGE",
      "READ_MEDIA_IMAGES",
      "SCHEDULE_EXACT_ALARM",
      "SYSTEM_ALERT_WINDOW",
      "USE_BIOMETRIC",
      "USE_FULL_SCREEN_INTENT",
      "VIBRATE",
      "WAKE_LOCK",
      "WRITE_EXTERNAL_STORAGE"
    ]
  },
  web: {
    privacyPolicyUrl: "https://example.com/privacy"
  },
  extra: {
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyB5H58jpb6RxcpG8bKeEd0RsvzkIqPBLOU",
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "vizminder-20b7a.firebaseapp.com",
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "vizminder-20b7a",
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "vizminder-20b7a.firebasestorage.app",
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "413650478333",
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:413650478333:web:99661ff33bf09a72aa0a94",
    eas: {
      projectId: "b31c2510-2c12-4747-8fd9-3fae35003f4f"
    }
  }
};
