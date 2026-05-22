// Dev-only helper: exposes window.fbTest with POST/GET probes for Firestore.
// Use in browser DevTools console after the app loads:
//   await fbTest.get()                          -> reads reminders for current user
//   await fbTest.post()                         -> writes a sample reminder (POST/PUT)
//   await fbTest.post({ title: "Hello" })       -> writes with custom fields
//   await fbTest.delete(id)                     -> removes a reminder by id
//   fbTest.info()                               -> shows config + current uid

import { Platform } from "react-native";
import {
  getFirebaseServices,
  getFirebaseDebugInfo,
  fetchRemindersFromFirestore,
  saveReminderToFirestore,
  deleteReminderFromFirestore,
  signInGuest
} from "./firebase";

function makeId() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureUser() {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase not configured. Check .env / app.config.js extra fields.");
  }
  await services.auth.authStateReady?.().catch(() => {});
  if (services.auth.currentUser) {
    return services.auth.currentUser.uid;
  }
  const result = await signInGuest();
  return result.user?.uid || "offline-user";
}

export function installDevTest() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }
  if (window.fbTest) {
    return;
  }

  const api = {
    async info() {
      const info = getFirebaseDebugInfo();
      const services = getFirebaseServices();
      const uid = services?.auth?.currentUser?.uid || "(no user yet)";
      const out = { ...info, uid, platform: Platform.OS };
      console.log("[fbTest.info]", out);
      return out;
    },

    async get() {
      console.log("[fbTest.get] GET reminders -> starting");
      const t0 = performance.now();
      try {
        const uid = await ensureUser();
        const rows = await fetchRemindersFromFirestore(uid);
        const ms = Math.round(performance.now() - t0);
        console.log(`[fbTest.get] OK in ${ms}ms - uid=${uid} count=${rows.length}`, rows);
        return rows;
      } catch (err) {
        console.error("[fbTest.get] FAILED", err);
        throw err;
      }
    },

    async post(overrides = {}) {
      console.log("[fbTest.post] POST reminder -> starting", overrides);
      const t0 = performance.now();
      try {
        const uid = await ensureUser();
        const reminder = {
          id: overrides.id || makeId(),
          title: overrides.title || "Console test reminder",
          description: overrides.description || "Created via window.fbTest.post()",
          scheduledAt: overrides.scheduledAt || new Date().toISOString(),
          completed: overrides.completed ?? false,
          createdAt: overrides.createdAt || new Date().toISOString(),
          ...overrides
        };
        const result = await saveReminderToFirestore(uid, reminder);
        const ms = Math.round(performance.now() - t0);
        console.log(`[fbTest.post] OK in ${ms}ms - uid=${uid}`, { result, reminder });
        return { reminder, result };
      } catch (err) {
        console.error("[fbTest.post] FAILED", err);
        throw err;
      }
    },

    async delete(id) {
      if (!id) {
        throw new Error("fbTest.delete(id) requires an id");
      }
      console.log("[fbTest.delete] DELETE", id);
      try {
        const uid = await ensureUser();
        const result = await deleteReminderFromFirestore(uid, id);
        console.log("[fbTest.delete] OK", result);
        return result;
      } catch (err) {
        console.error("[fbTest.delete] FAILED", err);
        throw err;
      }
    },

    async roundTrip() {
      console.log("[fbTest.roundTrip] POST -> GET -> DELETE");
      const { reminder } = await api.post({ title: "Round-trip test" });
      const rows = await api.get();
      const found = rows.find((r) => r.id === reminder.id);
      console.log("[fbTest.roundTrip] verify -> found?", Boolean(found), found);
      await api.delete(reminder.id);
      console.log("[fbTest.roundTrip] DONE");
      return { posted: reminder, foundOnGet: Boolean(found) };
    }
  };

  window.fbTest = api;
  console.log(
    "%c[fbTest] ready",
    "color:#fff;background:#007AFF;padding:2px 6px;border-radius:4px",
    "- try: await fbTest.info(), await fbTest.get(), await fbTest.post(), await fbTest.roundTrip()"
  );
}
