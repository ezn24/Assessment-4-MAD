import AsyncStorage from "@react-native-async-storage/async-storage";
import { hydrateReminder, serializeReminder } from "../models/reminder";

const WEB_STORAGE_KEY = "vizminder-a4-web-reminders";

export async function getDatabase() {
  return null;
}

export async function listReminders() {
  const raw = await AsyncStorage.getItem(WEB_STORAGE_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(hydrateReminder) : [];
  } catch (e) {
    return [];
  }
}

export async function upsertReminder(reminder) {
  const item = serializeReminder({ ...reminder, updatedAt: new Date().toISOString() });
  const list = await listReminders();
  const index = list.findIndex((x) => x.id === item.id);
  if (index >= 0) {
    list[index] = item;
  } else {
    list.push(item);
  }
  await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  return hydrateReminder(item);
}

export async function deleteReminder(id) {
  const list = await listReminders();
  const filtered = list.filter((x) => x.id !== id);
  await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(filtered)).catch(() => {});
}

export async function clearReminders() {
  await AsyncStorage.removeItem(WEB_STORAGE_KEY).catch(() => {});
}

export async function seedIfEmpty() {
  const list = await listReminders();
  const filtered = list.filter((x) => x.id !== "medication" && x.id !== "bring-keys");
  await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(filtered)).catch(() => {});
}
