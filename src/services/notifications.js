import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const REMINDER_CHANNEL_ID = "vizminder-a4-reminders";

if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      })
    });
  } catch (e) {
    console.warn("Failed to set notification handler:", e);
  }
}

export async function configureNotifications() {
  if (Platform.OS === "web") {
    return false;
  }
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "VizMinder reminders",
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
      vibrationPattern: [0, 450, 200, 450],
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM
      }
    });
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (e) {
    console.warn("Failed to configure notifications:", e);
    return false;
  }
}

export async function scheduleReminder(reminder) {
  if (Platform.OS === "web") {
    return null;
  }
  try {
    const granted = await configureNotifications();
    if (!granted || reminder.completed) {
      return null;
    }
    const date = new Date(reminder.scheduledAt);
    if (date <= new Date()) {
      return null;
    }
    const seconds = Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `VizMinder: ${reminder.title}`,
        body: reminder.description?.trim() || "",
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { reminderId: reminder.id }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        channelId: REMINDER_CHANNEL_ID
      }
    });
  } catch (e) {
    console.warn("Failed to schedule notification:", e);
    return null;
  }
}

export async function cancelReminderNotification(notificationId) {
  if (Platform.OS === "web") {
    return;
  }
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
  }
}

export function listenForReminderNotifications(onReminderId) {
  if (Platform.OS === "web") {
    return () => {};
  }
  try {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const reminderId = notification.request.content.data?.reminderId;
      if (reminderId) {
        onReminderId(reminderId);
      }
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const reminderId = event.notification.request.content.data?.reminderId;
      if (reminderId) {
        onReminderId(reminderId);
      }
    });
    return () => {
      received.remove();
      response.remove();
    };
  } catch (e) {
    console.warn("Failed to add notification listeners:", e);
    return () => {};
  }
}
