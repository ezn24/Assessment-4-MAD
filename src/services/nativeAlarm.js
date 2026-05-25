import { NativeEventEmitter, NativeModules, Platform } from "react-native";

const { AlarmScheduler } = NativeModules;
// NativeEventEmitter wires up addListener / removeListeners on the Kotlin side
const alarmEmitter = Platform.OS === "android" && AlarmScheduler ? new NativeEventEmitter(AlarmScheduler) : null;

/**
 * Subscribe to alarm button responses from the native AlarmActivity.
 * Callback receives { reminderId: string, mode: "yes" | "no" | "confirmed" }.
 * Returns an unsubscribe function.
 */
export function addAlarmResponseListener(callback) {
  if (!alarmEmitter) return () => {};
  const subscription = alarmEmitter.addListener("AlarmResponse", callback);
  return () => subscription.remove();
}

export async function requestExactAlarmPermission() {
  if (Platform.OS !== "android" || !AlarmScheduler) {
    return true;
  }
  try {
    return await AlarmScheduler.requestExactAlarmPermission();
  } catch {
    return false;
  }
}

export async function canScheduleExactAlarms() {
  if (Platform.OS !== "android" || !AlarmScheduler) {
    return true;
  }
  try {
    return await AlarmScheduler.canScheduleExactAlarms();
  } catch {
    return false;
  }
}

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
    reminder.title?.trim() || "Reminder",
    reminder.description?.trim() || "",
    fireAt.toISOString(),
    Boolean(reminder.repeat),
    reminder.ringtone || "alarm",
    reminder.visualType || (reminder.imageUri ? "image" : "icon"),
    reminder.icon || "bell-outline",
    reminder.emoji || "\u{1F514}",
    reminder.imageUri || "",
    reminder.repeatUntil || "",
    reminder.followUpEnabled ? Number(reminder.followUpCount || 0) : 0,
    Number(reminder.followUpIntervalMinutes || 5),
    reminder.notificationSound !== false,
    reminder.notificationVibration !== false
  );
}

export async function showNativeAlarmNow(reminder) {
  if (Platform.OS !== "android" || !AlarmScheduler || !reminder) {
    return false;
  }
  const fireAt = new Date();
  return AlarmScheduler.showAlarmNow(
    reminder.id,
    reminder.title?.trim() || "Reminder",
    reminder.description?.trim() || "",
    fireAt.toISOString(),
    Boolean(reminder.repeat),
    reminder.ringtone || "alarm",
    reminder.visualType || (reminder.imageUri ? "image" : "icon"),
    reminder.icon || "bell-outline",
    reminder.emoji || "\u{1F514}",
    reminder.imageUri || "",
    reminder.repeatUntil || "",
    reminder.followUpEnabled ? Number(reminder.followUpCount || 0) : 0,
    Number(reminder.followUpIntervalMinutes || 5),
    reminder.notificationSound !== false,
    reminder.notificationVibration !== false
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
  if (reminder.repeatUntil && scheduled > new Date(reminder.repeatUntil)) {
    return null;
  }
  const next = new Date();
  next.setHours(scheduled.getHours(), scheduled.getMinutes(), 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
