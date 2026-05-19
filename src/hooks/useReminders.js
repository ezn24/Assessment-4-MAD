import { useCallback, useEffect, useMemo, useState } from "react";
import { addMinutes, format, formatDistanceStrict, isSameDay, parseISO } from "date-fns";
import { clearReminders, deleteReminder as deleteStoredReminder, listReminders, seedIfEmpty, upsertReminder } from "../services/storage";
import {
  deleteReminderFromFirestore,
  fetchRemindersFromFirestore,
  getFirebaseServices,
  saveReminderToFirestore,
  signInGuest,
  syncRemindersToFirestore
} from "../services/firebase";

function normalizeReminder(reminder) {
  return {
    visualType: reminder.visualType || (reminder.imageUri ? "image" : "icon"),
    emoji: reminder.emoji || "\u{1F514}",
    icon: reminder.icon || "bell-outline",
    description: reminder.description || "",
    timeSet: reminder.timeSet !== false,
    hasDate: reminder.hasDate !== false,
    repeat: Boolean(reminder.repeat),
    ringtone: reminder.ringtone || "alarm",
    important: Boolean(reminder.important),
    completed: Boolean(reminder.completed),
    streak: reminder.streak || 0,
    updatedAt: reminder.updatedAt || new Date().toISOString(),
    latitude: reminder.latitude ?? null,
    longitude: reminder.longitude ?? null,
    locationLabel: reminder.locationLabel || "",
    notificationId: reminder.notificationId || null,
    ...reminder
  };
}

function getCurrentFirebaseUserId() {
  const services = getFirebaseServices();
  return services?.auth?.currentUser?.uid || null;
}

async function tryCloudSync(reminders) {
  const userId = getCurrentFirebaseUserId();
  if (userId) {
    await syncRemindersToFirestore(userId, reminders).catch(() => {});
  }
}

async function tryCloudSave(reminder) {
  const userId = getCurrentFirebaseUserId();
  if (userId) {
    await saveReminderToFirestore(userId, reminder).catch(() => {});
  }
}

async function tryCloudDelete(reminderId) {
  const userId = getCurrentFirebaseUserId();
  if (userId) {
    await deleteReminderFromFirestore(userId, reminderId).catch(() => {});
  }
}

export function useReminders() {
  const [reminders, setReminders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      await seedIfEmpty();
      const stored = (await listReminders()).map(normalizeReminder);
      if (!cancelled) {
        setReminders(stored);
        setLoaded(true);
      }

      const session = await signInGuest().catch(() => null);
      const userId = session?.user?.uid;
      const cloud = userId ? await fetchRemindersFromFirestore(userId).catch(() => []) : [];
      if (cloud.length) {
        const merged = mergeReminders(stored, cloud.map(normalizeReminder));
        await Promise.all(merged.map(upsertReminder));
        if (!cancelled) {
          setReminders(merged);
        }
      }
    }
    restore().catch(() => {
      setReminders([]);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const replaceReminderState = useCallback((updater) => {
    setReminders((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      tryCloudSync(next);
      return next;
    });
  }, []);

  const completeReminder = useCallback((id) => {
    replaceReminderState((items) => {
      const next = items.map((item) =>
        item.id === id
          ? { ...item, completed: true, completedAt: new Date().toISOString(), streak: (item.streak || 0) + 1 }
          : item
      );
      const changed = next.find((item) => item.id === id);
      if (changed) {
        upsertReminder(changed).catch(() => {});
        tryCloudSave(changed);
      }
      return next;
    });
  }, [replaceReminderState]);

  const attachImage = useCallback((id, imageUri) => {
    replaceReminderState((items) => {
      const next = items.map((item) => (item.id === id ? { ...item, imageUri, visualType: "image" } : item));
      const changed = next.find((item) => item.id === id);
      if (changed) {
        upsertReminder(changed).catch(() => {});
        tryCloudSave(changed);
      }
      return next;
    });
  }, [replaceReminderState]);

  const updateReminder = useCallback((id, patch) => {
    replaceReminderState((items) => {
      const next = items.map((item) => (item.id === id ? normalizeReminder({ ...item, ...patch }) : item));
      const changed = next.find((item) => item.id === id);
      if (changed) {
        upsertReminder(changed).catch(() => {});
        tryCloudSave(changed);
      }
      return next;
    });
  }, [replaceReminderState]);

  const deleteReminder = useCallback((id) => {
    replaceReminderState((items) => items.filter((item) => item.id !== id));
    deleteStoredReminder(id).catch(() => {});
    tryCloudDelete(id);
  }, [replaceReminderState]);

  const addReminder = useCallback((draft = {}) => {
    const nextReminder = normalizeReminder({
      id: draft.id || `reminder-${Date.now()}`,
      title: "New reminder",
      description: "Add a visual cue and simple prompt",
      visualCue: "Photo or icon cue",
      icon: "bell-outline",
      scheduledAt: addMinutes(new Date(), 30).toISOString(),
      timeSet: true,
      hasDate: false,
      repeat: false,
      important: false,
      completed: false,
      imageUri: null,
      streak: 0,
      ...draft
    });
    replaceReminderState((items) => [nextReminder, ...items]);
    upsertReminder(nextReminder).catch(() => {});
    tryCloudSave(nextReminder);
    return nextReminder;
  }, [replaceReminderState]);

  const resetPrototype = useCallback(() => {
    replaceReminderState([]);
    clearReminders().catch(() => {});
  }, [replaceReminderState]);

  const visibleReminders = useMemo(
    () => reminders.filter((item) => isSameDay(parseISO(item.scheduledAt), parseISO(selectedDate))),
    [reminders, selectedDate]
  );

  const markedDates = useMemo(() => {
    return reminders.reduce((dates, reminder) => {
      if (reminder.hasDate === false) {
        return dates;
      }
      const day = format(parseISO(reminder.scheduledAt), "yyyy-MM-dd");
      const color = reminder.completed ? "#2E7D32" : reminder.important ? "#B3261E" : "#1565C0";
      dates[day] = {
        ...(dates[day] || {}),
        marked: true,
        dotColor: color,
        selected: day === selectedDate,
        selectedColor: "#1565C0"
      };
      return dates;
    }, {});
  }, [reminders, selectedDate]);

  const getCountdown = useCallback((isoDate) => {
    const target = parseISO(isoDate);
    const now = new Date();
    if (target < now) {
      return "Due now";
    }
    return `${formatDistanceStrict(target, now)} left`;
  }, []);

  return {
    reminders,
    visibleReminders,
    selectedDate,
    markedDates,
    setSelectedDate,
    completeReminder,
    attachImage,
    updateReminder,
    addReminder,
    deleteReminder,
    resetPrototype,
    getCountdown,
    loaded
  };
}

function mergeReminders(localReminders, cloudReminders) {
  const byId = new Map();
  [...localReminders, ...cloudReminders].forEach((reminder) => {
    const current = byId.get(reminder.id);
    if (!current || new Date(reminder.updatedAt || 0) >= new Date(current.updatedAt || 0)) {
      byId.set(reminder.id, reminder);
    }
  });
  return Array.from(byId.values()).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}
