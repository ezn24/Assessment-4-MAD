import { createReminderDraft, hydrateReminder, isDue, serializeReminder } from "../src/models/reminder";

describe("reminder model", () => {
  test("creates a reminder draft with required fields", () => {
    const draft = createReminderDraft({ title: "Bring keys" });

    expect(draft.id).toContain("reminder-");
    expect(draft.title).toBe("Bring keys");
    expect(draft.completed).toBe(false);
    expect(draft.important).toBe(true);
    expect(new Date(draft.scheduledAt).toString()).not.toBe("Invalid Date");
  });

  test("detects due reminders", () => {
    const reminder = createReminderDraft({
      scheduledAt: "2026-05-18T09:00:00.000Z",
      completed: false
    });

    expect(isDue(reminder, new Date("2026-05-18T09:01:00.000Z"))).toBe(true);
    expect(isDue({ ...reminder, completed: true }, new Date("2026-05-18T09:01:00.000Z"))).toBe(false);
  });

  test("serializes and hydrates boolean fields for SQLite", () => {
    const reminder = createReminderDraft({ important: true, completed: false });
    const row = serializeReminder(reminder);

    expect(row.important).toBe(1);
    expect(row.completed).toBe(0);
    expect(hydrateReminder(row).important).toBe(true);
    expect(hydrateReminder(row).completed).toBe(false);
  });
});
