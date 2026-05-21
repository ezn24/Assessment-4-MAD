import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getExpoExtra } from "./expoConfig";

const reactNativeAuthPersistence = {
  type: "LOCAL",
  async _isAvailable() {
    return true;
  },
  async _set(key, value) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async _get(key) {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  async _remove(key) {
    await AsyncStorage.removeItem(key);
  },
  _addListener() {},
  _removeListener() {}
};

let firebaseServices = null;

function getConfig() {
  const extra = getExpoExtra();
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

export function getFirebaseDebugInfo() {
  const config = getConfig();
  if (!config) {
    return { configured: false, projectId: "" };
  }
  return { configured: true, projectId: config.projectId };
}

export function getFirebaseServices() {
  const config = getConfig();
  if (!config) {
    return null;
  }
  if (firebaseServices) {
    return firebaseServices;
  }
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  let auth;
  try {
    auth = initializeAuth(app, { persistence: reactNativeAuthPersistence });
  } catch (_error) {
    auth = getAuth(app);
  }
  firebaseServices = {
    app,
    auth,
    db: getFirestore(app)
  };
  return firebaseServices;
}

export function listenToAuthState(callback) {
  const services = getFirebaseServices();
  if (!services) {
    callback({ uid: "offline-user", isAnonymous: true, email: "" });
    return () => {};
  }
  return onAuthStateChanged(services.auth, callback);
}

export function validatePassword(password) {
  const letters = (password.match(/[A-Za-z]/g) || []).length;
  const digits = (password.match(/\d/g) || []).length;
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (letters < 2) {
    return "Password must contain at least 2 letters.";
  }
  if (digits < 6) {
    return "Password must contain at least 6 numbers.";
  }
  return "";
}

export async function registerWithEmail(email, password) {
  const error = validatePassword(password);
  if (error) {
    throw new Error(error);
  }
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase is not configured.");
  }
  const credential = await createUserWithEmailAndPassword(services.auth, email.trim(), password).catch((error) => {
    throw new Error(getReadableAuthError(error));
  });
  return credential.user;
}

export async function loginWithEmail(email, password) {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase is not configured.");
  }
  const credential = await signInWithEmailAndPassword(services.auth, email.trim(), password).catch((error) => {
    throw new Error(getReadableAuthError(error));
  });
  return credential.user;
}

function getReadableAuthError(error) {
  if (error?.code === "auth/operation-not-allowed") {
    return "This Firebase sign-in provider is not enabled. Enable Email/Password in Firebase Console > Authentication > Sign-in method.";
  }
  if (error?.code === "auth/invalid-credential") {
    return "Invalid email or password.";
  }
  if (error?.code === "auth/email-already-in-use") {
    return "This email is already registered. Use Login instead.";
  }
  if (error?.code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }
  return error?.message || "Firebase sign-in failed.";
}

export async function signInGuest() {
  const services = getFirebaseServices();
  if (!services) {
    return { offline: true, user: { uid: "offline-user", isAnonymous: true } };
  }
  await services.auth.authStateReady?.().catch(() => {});
  if (services.auth.currentUser) {
    return { offline: false, user: services.auth.currentUser };
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

export async function saveReminderToFirestore(userId, reminder) {
  const services = getFirebaseServices();
  if (!services || !userId || userId === "offline-user") {
    return { skipped: true };
  }
  await setDoc(doc(services.db, "users", userId, "reminders", reminder.id), reminder);
  return { saved: true };
}

export async function deleteReminderFromFirestore(userId, reminderId) {
  const services = getFirebaseServices();
  if (!services || !userId || userId === "offline-user") {
    return { skipped: true };
  }
  await deleteDoc(doc(services.db, "users", userId, "reminders", reminderId));
  return { deleted: true };
}

export async function fetchRemindersFromFirestore(userId) {
  const services = getFirebaseServices();
  if (!services || !userId || userId === "offline-user") {
    return [];
  }
  const snapshot = await getDocs(collection(services.db, "users", userId, "reminders"));
  return snapshot.docs.map((item) => item.data());
}
