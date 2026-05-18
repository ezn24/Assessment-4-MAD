const fs = require("fs");
const path = require("path");

const packageDir = path.join(__dirname, "..", "node_modules", "expo-notifications-local");
fs.mkdirSync(packageDir, { recursive: true });

fs.writeFileSync(
  path.join(packageDir, "package.json"),
  `${JSON.stringify({ name: "expo-notifications-local", version: "0.0.0", main: "index.js", private: true }, null, 2)}\n`
);

// Expo Go on Android SDK 53+ cannot load the push-token parts of expo-notifications.
// This wrapper exports only local-notification APIs used by this app.
fs.writeFileSync(
  path.join(packageDir, "index.js"),
  `export { scheduleNotificationAsync } from "../expo-notifications/build/scheduleNotificationAsync.js";
export { cancelScheduledNotificationAsync } from "../expo-notifications/build/cancelScheduledNotificationAsync.js";
export { cancelAllScheduledNotificationsAsync } from "../expo-notifications/build/cancelAllScheduledNotificationsAsync.js";
export { setNotificationChannelAsync } from "../expo-notifications/build/setNotificationChannelAsync.js";
export { requestPermissionsAsync, getPermissionsAsync } from "../expo-notifications/build/NotificationPermissions.js";
export { addNotificationReceivedListener, addNotificationResponseReceivedListener } from "../expo-notifications/build/NotificationsEmitter.js";
export { setNotificationHandler } from "../expo-notifications/build/NotificationsHandler.js";
export { AndroidNotificationPriority, SchedulableTriggerInputTypes } from "../expo-notifications/build/Notifications.types.js";
export {
  AndroidAudioUsage,
  AndroidImportance,
  AndroidNotificationVisibility
} from "../expo-notifications/build/NotificationChannelManager.types.js";
`
);
