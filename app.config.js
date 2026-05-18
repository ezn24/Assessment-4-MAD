const appJson = require("./app.json");

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || appJson.expo.extra.firebaseApiKey,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || appJson.expo.extra.firebaseAuthDomain,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || appJson.expo.extra.firebaseProjectId,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || appJson.expo.extra.firebaseStorageBucket,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || appJson.expo.extra.firebaseMessagingSenderId,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || appJson.expo.extra.firebaseAppId
  }
};
