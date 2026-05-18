export function createReminderDraft(overrides = {}) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return {
    id: `reminder-${Date.now()}`,
    title: "",
    description: "",
    scheduledAt: now.toISOString(),
    visualType: "emoji",
    emoji: "🔔",
    icon: "bell-outline",
    imageUri: null,
    important: true,
    completed: false,
    latitude: null,
    longitude: null,
    locationLabel: "",
    notificationId: null,
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

export function isDue(reminder, now = new Date()) {
  return !reminder.completed && new Date(reminder.scheduledAt) <= now;
}

export function serializeReminder(reminder) {
  return {
    ...reminder,
    important: reminder.important ? 1 : 0,
    completed: reminder.completed ? 1 : 0
  };
}

export function hydrateReminder(row) {
  return {
    ...row,
    important: Boolean(row.important),
    completed: Boolean(row.completed)
  };
}
