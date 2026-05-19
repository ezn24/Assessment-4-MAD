import { NativeModules, Platform } from "react-native";

const { AlarmScheduler } = NativeModules;

export async function scheduleNativeAlarm(reminder) {
  if (Platform.OS !== "android" || !AlarmScheduler || reminder.completed || reminder.timeSet === false) {
    return false;
  }
  const fireAt = getNativeAlarmFireDate(reminder);
  if (!fireAt) {
    return false;
  }

  return AlarmScheduler.scheduleAlarm(
    reminder.id,
    `VizMinder: ${reminder.title?.trim() || "Reminder"}`,
    reminder.description?.trim() || "Time to check this visual reminder.",
    fireAt.toISOString(),
    Boolean(reminder.repeat),
    reminder.ringtone || "alarm"
  );
}

export async function cancelNativeAlarm(reminderId) {
  if (Platform.OS !== "android" || !AlarmScheduler || !reminderId) {
    return false;
  }
  return AlarmScheduler.cancelAlarm(reminderId);
}

function getNativeAlarmFireDate(reminder) {
  const scheduled = new Date(reminder.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) {
    return null;
  }
  if (reminder.hasDate !== false && !reminder.repeat) {
    return scheduled > new Date() ? scheduled : null;
  }
  const next = new Date();
  next.setHours(scheduled.getHours(), scheduled.getMinutes(), 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
