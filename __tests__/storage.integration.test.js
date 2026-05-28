/**
 * Integration test: storage.js + reminder model + mocked expo-sqlite.
 *
 * Verifies the round-trip through the SQLite layer:
 *   createReminderDraft -> upsertReminder -> listReminders -> deleteReminder
 *
 * The mock acts as a tiny in-memory key/value store keyed by reminder.id,
 * so we can confirm that the SQL parameter order, the boolean (0/1)
 * serialisation, and the hydration back to JS booleans all line up.
 */

import * as SQLite from "expo-sqlite";
import {
  upsertReminder,
  listReminders,
  deleteReminder,
  clearReminders
} from "../src/services/storage";
import { createReminderDraft } from "../src/models/reminder";

const REMINDER_COLUMNS = [
  "id", "title", "description", "scheduledAt", "visualType", "emoji",
  "icon", "imageUri", "important", "repeat", "repeatUntil",
  "followUpEnabled", "followUpCount", "followUpIntervalMinutes",
  "promptYesCount", "promptNoCount", "promptConfirmedCount",
  "timeSet", "hasDate", "ringtone", "priority", "completed",
  "latitude", "longitude", "locationLabel", "notificationId", "updatedAt"
];

function makeFakeDb() {
  const store = new Map();
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn(async (sql) => {
      if (sql.startsWith("PRAGMA")) {
        return REMINDER_COLUMNS.map((name) => ({ name }));
      }
      // SELECT * FROM reminders ORDER BY scheduledAt ASC
      return [...store.values()].sort((a, b) =>
        String(a.scheduledAt).localeCompare(String(b.scheduledAt))
      );
    }),
    runAsync: jest.fn(async (sql, params) => {
      if (sql.startsWith("INSERT OR REPLACE INTO reminders")) {
        const row = {};
        REMINDER_COLUMNS.forEach((col, i) => { row[col] = params[i]; });
        store.set(row.id, row);
        return { changes: 1 };
      }
      if (sql.startsWith("DELETE FROM reminders WHERE id")) {
        store.delete(params[0]);
        return { changes: 1 };
      }
      if (sql.startsWith("DELETE FROM reminders")) {
        store.clear();
        return { changes: 1 };
      }
      return { changes: 0 };
    }),
    __store: store
  };
}

describe("storage integration (SQLite-mocked)", () => {
  let db;

  beforeEach(() => {
    db = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(db);
    // Force a fresh db promise per test by mutating the module's internal
    // state — storage.js caches dbPromise across calls.
    jest.resetModules();
  });

  test("inserts a reminder and lists it back with hydrated booleans", async () => {
    await clearReminders();
    const draft = createReminderDraft({
      id: "rem-int-1",
      title: "Take medication",
      important: true,
      completed: false
    });

    await upsertReminder(draft);
    const rows = await listReminders();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("rem-int-1");
    expect(rows[0].title).toBe("Take medication");
    // serialized as 1/0 in the row, hydrated back to booleans
    expect(rows[0].important).toBe(true);
    expect(rows[0].completed).toBe(false);
    // raw row in the fake store should be 1/0 (SQLite-compatible)
    expect(db.__store.get("rem-int-1").important).toBe(1);
    expect(db.__store.get("rem-int-1").completed).toBe(0);
  });

  test("updates a reminder via upsert and reflects new state", async () => {
    const draft = createReminderDraft({ id: "rem-int-2", title: "Walk dog" });
    await upsertReminder(draft);
    await upsertReminder({ ...draft, completed: true, title: "Walk dog ✔" });

    const rows = await listReminders();
    const updated = rows.find((r) => r.id === "rem-int-2");
    expect(updated.title).toBe("Walk dog ✔");
    expect(updated.completed).toBe(true);
  });

  test("deleteReminder removes only the requested row", async () => {
    await upsertReminder(createReminderDraft({ id: "rem-int-3a", title: "A" }));
    await upsertReminder(createReminderDraft({ id: "rem-int-3b", title: "B" }));

    await deleteReminder("rem-int-3a");
    const rows = await listReminders();

    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(["rem-int-3b"]));
    expect(rows.find((r) => r.id === "rem-int-3a")).toBeUndefined();
  });
});
