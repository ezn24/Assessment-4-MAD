import * as Notifications from "expo-notifications";

export const REMINDER_CHANNEL_ID = "vizminder-a4-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function configureNotifications() {
  if (Platform.OS === "android") {
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
  }
  const current = await Notifications.getPermissionsAsync();
  if (current?.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested?.granted || false;
}

export async function scheduleReminder(reminder) {
  const granted = await configureNotifications();
  if (!granted || reminder.completed) {
    return null;
  }
  const date = new Date(reminder.scheduledAt);
  if (date <= new Date()) {
    return null;
  }
  const seconds = Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `VizMinder: ${reminder.title}`,
      body: reminder.description || "Time to check your visual reminder.",
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
}

export async function cancelReminderNotification(notificationId) {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
  }
}

export function listenForReminderNotifications(onReminderId) {
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
}
