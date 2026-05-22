import { Platform } from "react-native";
import { hydrateReminder, serializeReminder } from "../models/reminder";

let SQLite = null;
let AsyncStorage = null;

if (Platform.OS !== "web") {
  try {
    SQLite = require("expo-sqlite");
  } catch (e) {
    console.warn("SQLite not available:", e);
  }
} else {
  try {
    AsyncStorage = require("@react-native-async-storage/async-storage").default;
  } catch (e) {
    console.warn("AsyncStorage not available:", e);
  }
}

let dbPromise;
let webStorage = {};

export async function getDatabase() {
  if (Platform.OS === "web" || !SQLite) {
    return { getAllAsync: () => [], runAsync: () => {}, execAsync: () => {} };
  }
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("vizminder-a4.db");
  }
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scheduledAt TEXT NOT NULL,
      visualType TEXT NOT NULL,
      emoji TEXT,
      icon TEXT,
      imageUri TEXT,
      important INTEGER NOT NULL DEFAULT 0,
      repeat INTEGER NOT NULL DEFAULT 0,
      repeatUntil TEXT,
      followUpEnabled INTEGER NOT NULL DEFAULT 0,
      followUpCount INTEGER NOT NULL DEFAULT 0,
      followUpIntervalMinutes INTEGER NOT NULL DEFAULT 5,
      timeSet INTEGER NOT NULL DEFAULT 1,
      hasDate INTEGER NOT NULL DEFAULT 1,
      ringtone TEXT NOT NULL DEFAULT 'alarm',
      completed INTEGER NOT NULL DEFAULT 0,
      latitude REAL,
      longitude REAL,
      locationLabel TEXT,
      notificationId TEXT,
      updatedAt TEXT NOT NULL
    );
  `);
  await migrateReminderColumns(db);
  return db;
}

async function migrateReminderColumns(db) {
  if (Platform.OS === "web" || !SQLite) {
    return;
  }
  const columns = await db.getAllAsync("PRAGMA table_info(reminders)");
  const names = new Set(columns.map((column) => column.name));
  const migrations = [
    ["repeat", "ALTER TABLE reminders ADD COLUMN repeat INTEGER NOT NULL DEFAULT 0"],
    ["repeatUntil", "ALTER TABLE reminders ADD COLUMN repeatUntil TEXT"],
    ["followUpEnabled", "ALTER TABLE reminders ADD COLUMN followUpEnabled INTEGER NOT NULL DEFAULT 0"],
    ["followUpCount", "ALTER TABLE reminders ADD COLUMN followUpCount INTEGER NOT NULL DEFAULT 0"],
    ["followUpIntervalMinutes", "ALTER TABLE reminders ADD COLUMN followUpIntervalMinutes INTEGER NOT NULL DEFAULT 5"],
    ["timeSet", "ALTER TABLE reminders ADD COLUMN timeSet INTEGER NOT NULL DEFAULT 1"],
    ["hasDate", "ALTER TABLE reminders ADD COLUMN hasDate INTEGER NOT NULL DEFAULT 1"],
    ["ringtone", "ALTER TABLE reminders ADD COLUMN ringtone TEXT NOT NULL DEFAULT 'alarm'"]
  ];
  for (const [name, statement] of migrations) {
    if (!names.has(name)) {
      await db.execAsync(statement);
    }
  }
}

export async function listReminders() {
  if (Platform.OS === "web" || !SQLite) {
    if (AsyncStorage) {
      try {
        const data = await AsyncStorage.getItem("reminders");
        const reminders = data ? JSON.parse(data) : [];
        return reminders.map(hydrateReminder);
      } catch (e) {
        console.warn("Failed to load from AsyncStorage:", e);
        return [];
      }
    }
    return Object.values(webStorage).map(hydrateReminder);
  }
  const db = await getDatabase();
  const rows = await db.getAllAsync("SELECT * FROM reminders ORDER BY scheduledAt ASC");
  return rows.map(hydrateReminder);
}

export async function upsertReminder(reminder) {
  const item = serializeReminder({ ...reminder, updatedAt: new Date().toISOString() });

  if (Platform.OS === "web" || !SQLite) {
    if (AsyncStorage) {
      try {
        const data = await AsyncStorage.getItem("reminders");
        const reminders = data ? JSON.parse(data) : [];
        const index = reminders.findIndex((r) => r.id === item.id);
        if (index >= 0) {
          reminders[index] = item;
        } else {
          reminders.push(item);
        }
        await AsyncStorage.setItem("reminders", JSON.stringify(reminders));
      } catch (e) {
        console.warn("Failed to save to AsyncStorage:", e);
      }
    } else {
      webStorage[item.id] = item;
    }
    return hydrateReminder(item);
  }

  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders
    (id, title, description, scheduledAt, visualType, emoji, icon, imageUri, important, repeat, repeatUntil, followUpEnabled, followUpCount, followUpIntervalMinutes, timeSet, hasDate, ringtone, completed, latitude, longitude, locationLabel, notificationId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.title,
      item.description,
      item.scheduledAt,
      item.visualType,
      item.emoji,
      item.icon,
      item.imageUri,
      item.important,
      item.repeat,
      item.repeatUntil,
      item.followUpEnabled,
      item.followUpCount,
      item.followUpIntervalMinutes,
      item.timeSet,
      item.hasDate,
      item.ringtone,
      item.completed,
      item.latitude,
      item.longitude,
      item.locationLabel,
      item.notificationId,
      item.updatedAt
    ]
  );
  return hydrateReminder(item);
}

export async function deleteReminder(id) {
  if (Platform.OS === "web" || !SQLite) {
    if (AsyncStorage) {
      try {
        const data = await AsyncStorage.getItem("reminders");
        const reminders = data ? JSON.parse(data) : [];
        const filtered = reminders.filter((r) => r.id !== id);
        await AsyncStorage.setItem("reminders", JSON.stringify(filtered));
      } catch (e) {
        console.warn("Failed to delete from AsyncStorage:", e);
      }
    } else {
      delete webStorage[id];
    }
    return;
  }
  const db = await getDatabase();
  await db.runAsync("DELETE FROM reminders WHERE id = ?", [id]);
}

export async function clearReminders() {
  if (Platform.OS === "web" || !SQLite) {
    if (AsyncStorage) {
      try {
        await AsyncStorage.setItem("reminders", "[]");
      } catch (e) {
        console.warn("Failed to clear AsyncStorage:", e);
      }
    } else {
      webStorage = {};
    }
    return;
  }
  const db = await getDatabase();
  await db.runAsync("DELETE FROM reminders");
}

export async function seedIfEmpty() {
  if (Platform.OS === "web" || !SQLite) {
    return;
  }
  const db = await getDatabase();
  // Assessment 4 starts with an empty task list. Remove legacy demo rows from earlier builds only.
  await db.runAsync("DELETE FROM reminders WHERE id IN (?, ?)", ["medication", "bring-keys"]);
}
