import * as SQLite from "expo-sqlite";
import { hydrateReminder, serializeReminder } from "../models/reminder";

let dbPromise;

export async function getDatabase() {
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
      promptYesCount INTEGER NOT NULL DEFAULT 0,
      promptNoCount INTEGER NOT NULL DEFAULT 0,
      promptConfirmedCount INTEGER NOT NULL DEFAULT 0,
      timeSet INTEGER NOT NULL DEFAULT 1,
      hasDate INTEGER NOT NULL DEFAULT 1,
      ringtone TEXT NOT NULL DEFAULT 'alarm',
      priority TEXT NOT NULL DEFAULT 'high',
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
  const columns = await db.getAllAsync("PRAGMA table_info(reminders)");
  const names = new Set(columns.map((column) => column.name));
  const migrations = [
    ["repeat", "ALTER TABLE reminders ADD COLUMN repeat INTEGER NOT NULL DEFAULT 0"],
    ["repeatUntil", "ALTER TABLE reminders ADD COLUMN repeatUntil TEXT"],
    ["followUpEnabled", "ALTER TABLE reminders ADD COLUMN followUpEnabled INTEGER NOT NULL DEFAULT 0"],
    ["followUpCount", "ALTER TABLE reminders ADD COLUMN followUpCount INTEGER NOT NULL DEFAULT 0"],
    ["followUpIntervalMinutes", "ALTER TABLE reminders ADD COLUMN followUpIntervalMinutes INTEGER NOT NULL DEFAULT 5"],
    ["promptYesCount", "ALTER TABLE reminders ADD COLUMN promptYesCount INTEGER NOT NULL DEFAULT 0"],
    ["promptNoCount", "ALTER TABLE reminders ADD COLUMN promptNoCount INTEGER NOT NULL DEFAULT 0"],
    ["promptConfirmedCount", "ALTER TABLE reminders ADD COLUMN promptConfirmedCount INTEGER NOT NULL DEFAULT 0"],
    ["timeSet", "ALTER TABLE reminders ADD COLUMN timeSet INTEGER NOT NULL DEFAULT 1"],
    ["hasDate", "ALTER TABLE reminders ADD COLUMN hasDate INTEGER NOT NULL DEFAULT 1"],
    ["ringtone", "ALTER TABLE reminders ADD COLUMN ringtone TEXT NOT NULL DEFAULT 'alarm'"],
    ["priority", "ALTER TABLE reminders ADD COLUMN priority TEXT NOT NULL DEFAULT 'high'"]
  ];
  for (const [name, statement] of migrations) {
    if (!names.has(name)) {
      await db.execAsync(statement);
    }
  }
}

export async function listReminders() {
  const db = await getDatabase();
  const rows = await db.getAllAsync("SELECT * FROM reminders ORDER BY scheduledAt ASC");
  return rows.map(hydrateReminder);
}

export async function upsertReminder(reminder) {
  const db = await getDatabase();
  const item = serializeReminder({ ...reminder, updatedAt: new Date().toISOString() });
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders
    (id, title, description, scheduledAt, visualType, emoji, icon, imageUri, important, repeat, repeatUntil, followUpEnabled, followUpCount, followUpIntervalMinutes, promptYesCount, promptNoCount, promptConfirmedCount, timeSet, hasDate, ringtone, priority, completed, latitude, longitude, locationLabel, notificationId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      item.promptYesCount,
      item.promptNoCount,
      item.promptConfirmedCount,
      item.timeSet,
      item.hasDate,
      item.ringtone,
      item.priority,
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
  const db = await getDatabase();
  await db.runAsync("DELETE FROM reminders WHERE id = ?", [id]);
}

export async function clearReminders() {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM reminders");
}

export async function seedIfEmpty() {
  const db = await getDatabase();
  // Assessment 4 starts with an empty task list. Remove legacy demo rows from earlier builds only.
  await db.runAsync("DELETE FROM reminders WHERE id IN (?, ?)", ["medication", "bring-keys"]);
}
