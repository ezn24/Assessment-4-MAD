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
      completed INTEGER NOT NULL DEFAULT 0,
      latitude REAL,
      longitude REAL,
      locationLabel TEXT,
      notificationId TEXT,
      updatedAt TEXT NOT NULL
    );
  `);
  return db;
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
    (id, title, description, scheduledAt, visualType, emoji, icon, imageUri, important, completed, latitude, longitude, locationLabel, notificationId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function seedIfEmpty() {
  const db = await getDatabase();
  const result = await db.getFirstAsync("SELECT COUNT(*) AS count FROM reminders");
  if (result?.count > 0) {
    return;
  }
  const base = new Date();
  const reminders = [
    {
      id: "medication",
      title: "Take medication",
      description: "Use the pill box photo before leaving.",
      scheduledAt: new Date(base.getTime() + 20 * 60 * 1000).toISOString(),
      visualType: "emoji",
      emoji: "💊",
      icon: "pill",
      imageUri: null,
      important: true,
      completed: false,
      latitude: null,
      longitude: null,
      locationLabel: "",
      notificationId: null,
      updatedAt: new Date().toISOString()
    },
    {
      id: "bring-keys",
      title: "Bring keys",
      description: "Check the entry table visual cue.",
      scheduledAt: new Date(base.getTime() + 55 * 60 * 1000).toISOString(),
      visualType: "emoji",
      emoji: "🔑",
      icon: "key",
      imageUri: null,
      important: true,
      completed: false,
      latitude: null,
      longitude: null,
      locationLabel: "Home entrance",
      notificationId: null,
      updatedAt: new Date().toISOString()
    }
  ];
  await Promise.all(reminders.map(upsertReminder));
}
