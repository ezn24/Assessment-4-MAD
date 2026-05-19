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
    repeat: false,
    timeSet: true,
    hasDate: false,
    ringtone: "alarm",
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
    repeat: reminder.repeat ? 1 : 0,
    timeSet: reminder.timeSet === false ? 0 : 1,
    hasDate: reminder.hasDate === false ? 0 : 1,
    completed: reminder.completed ? 1 : 0
  };
}

export function hydrateReminder(row) {
  return {
    ...row,
    important: Boolean(row.important),
    repeat: Boolean(row.repeat),
    timeSet: row.timeSet !== 0,
    hasDate: row.hasDate !== 0,
    ringtone: row.ringtone || "alarm",
    completed: Boolean(row.completed)
  };
}
