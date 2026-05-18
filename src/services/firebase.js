import Constants from "expo-constants";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, signOut } from "firebase/auth";
import { collection, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";

function getConfig() {
  const extra = Constants.expoConfig?.extra || {};
  if (!extra.firebaseApiKey || !extra.firebaseProjectId || extra.firebaseApiKey.includes("REPLACE")) {
    return null;
  }
  return {
    apiKey: extra.firebaseApiKey,
    authDomain: extra.firebaseAuthDomain,
    projectId: extra.firebaseProjectId,
    storageBucket: extra.firebaseStorageBucket,
    messagingSenderId: extra.firebaseMessagingSenderId,
    appId: extra.firebaseAppId
  };
}

export function isFirebaseConfigured() {
  return Boolean(getConfig());
}

export function getFirebaseServices() {
  const config = getConfig();
  if (!config) {
    return null;
  }
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app)
  };
}

export async function signInGuest() {
  const services = getFirebaseServices();
  if (!services) {
    return { offline: true, user: { uid: "offline-user", isAnonymous: true } };
  }
  const credential = await signInAnonymously(services.auth);
  return { offline: false, user: credential.user };
}

export async function signOutUser() {
  const services = getFirebaseServices();
  if (services) {
    await signOut(services.auth);
  }
}

export async function syncRemindersToFirestore(userId, reminders) {
  const services = getFirebaseServices();
  if (!services || !userId || userId === "offline-user") {
    return { skipped: true };
  }
  await Promise.all(
    reminders.map((reminder) => setDoc(doc(services.db, "users", userId, "reminders", reminder.id), reminder))
  );
  return { synced: reminders.length };
}

export async function fetchRemindersFromFirestore(userId) {
  const services = getFirebaseServices();
  if (!services || !userId || userId === "offline-user") {
    return [];
  }
  const snapshot = await getDocs(collection(services.db, "users", userId, "reminders"));
  return snapshot.docs.map((item) => item.data());
}
