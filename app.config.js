require("dotenv").config();

module.exports = {
  name: "VizMinder",
  slug: "vizminder",
  version: "2.0.0",
  assetBundlePatterns: [
    "**/*"
  ],
  extra: {
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
    eas: {
      projectId: "b31c2510-2c12-4747-8fd9-3fae35003f4f"
    }
  }
};
