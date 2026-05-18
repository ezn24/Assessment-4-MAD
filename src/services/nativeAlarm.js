import { NativeModules, Platform } from "react-native";

const { AlarmScheduler } = NativeModules;

export async function scheduleNativeAlarm(reminder) {
  if (Platform.OS !== "android" || !AlarmScheduler || reminder.completed || reminder.timeSet === false) {
    return false;
  }

  return AlarmScheduler.scheduleAlarm(
    reminder.id,
    `VizMinder: ${reminder.title?.trim() || "Reminder"}`,
    reminder.description?.trim() || "Time to check this visual reminder.",
    reminder.scheduledAt
  );
}

export async function cancelNativeAlarm(reminderId) {
  if (Platform.OS !== "android" || !AlarmScheduler || !reminderId) {
    return false;
  }
  return AlarmScheduler.cancelAlarm(reminderId);
}
