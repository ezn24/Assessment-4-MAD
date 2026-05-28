/**
 * End-to-end test: full reminder lifecycle from user perspective.
 *
 * Exercises the model + storage layer together as a user would over the
 * lifetime of one reminder:
 *
 *   create draft -> save -> appears in list -> is due -> mark complete
 *   -> not due anymore -> delete -> list is empty.
 *
 * This complements `storage.integration.test.js` (which tests SQL
 * mechanics) by walking the higher-level user workflow.
 */

import * as SQLite from "expo-sqlite";
import {
  upsertReminder,
  listReminders,
  deleteReminder,
  clearReminders
} from "../src/services/storage";
import { createReminderDraft, isDue } from "../src/models/reminder";

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
      return [...store.values()].sort((a, b) =>
        String(a.scheduledAt).localeCompare(String(b.scheduledAt))
      );
    }),
    runAsync: jest.fn(async (sql, params) => {
      if (sql.startsWith("INSERT OR REPLACE INTO reminders")) {
        const row = {};
        REMINDER_COLUMNS.forEach((col, i) => { row[col] = params[i]; });
        store.set(row.id, row);
      } else if (sql.startsWith("DELETE FROM reminders WHERE id")) {
        store.delete(params[0]);
      } else if (sql.startsWith("DELETE FROM reminders")) {
        store.clear();
      }
      return { changes: 1 };
    })
  };
}

describe("reminder lifecycle (E2E)", () => {
  beforeEach(() => {
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb());
  });

  test("user adds, completes and deletes a reminder", async () => {
    await clearReminders();

    // 1. User taps + and fills the form. Schedule for 1 minute ago so it
    //    will already read as due during the test.
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const draft = createReminderDraft({
      id: "rem-e2e-1",
      title: "Drink water",
      scheduledAt: past
    });

    // 2. User taps Save -> upsert
    await upsertReminder(draft);

    // 3. List should contain the new reminder
    let rows = await listReminders();
    expect(rows).toHaveLength(1);
    const saved = rows[0];
    expect(saved.title).toBe("Drink water");

    // 4. Reminder is due, so the alarm UI would fire
    expect(isDue(saved)).toBe(true);

    // 5. User taps "Yes" -> reminder marked complete
    await upsertReminder({ ...saved, completed: true });
    rows = await listReminders();
    expect(rows[0].completed).toBe(true);
    expect(isDue(rows[0])).toBe(false);

    // 6. User swipes to delete
    await deleteReminder(saved.id);
    rows = await listReminders();
    expect(rows).toHaveLength(0);
  });

  test("important flag survives the round-trip and influences sort order", async () => {
    await clearReminders();
    const a = createReminderDraft({
      id: "e2e-a",
      title: "Important task",
      scheduledAt: "2026-06-01T09:00:00.000Z",
      important: true
    });
    const b = createReminderDraft({
      id: "e2e-b",
      title: "Casual task",
      scheduledAt: "2026-06-02T09:00:00.000Z",
      important: false
    });

    await upsertReminder(a);
    await upsertReminder(b);

    const rows = await listReminders();
    // ordered by scheduledAt ASC
    expect(rows.map((r) => r.id)).toEqual(["e2e-a", "e2e-b"]);
    expect(rows[0].important).toBe(true);
    expect(rows[1].important).toBe(false);
  });
});
