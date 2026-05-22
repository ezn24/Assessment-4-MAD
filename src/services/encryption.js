import { Platform } from "react-native";
import CryptoJS from "crypto-js";

let SecureStore = null;

if (Platform.OS !== "web") {
  try {
    SecureStore = require("expo-secure-store");
  } catch (e) {
    console.warn("SecureStore not available:", e);
  }
}

const ENCRYPTION_KEY = "vizminder-a4-encryption-key";

async function getEncryptionKey() {
  if (Platform.OS === "web" || !SecureStore) {
    return "fallback-key-for-web-demo-only";
  }
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY);
    if (!key) {
      key = CryptoJS.lib.WordArray.random(32).toString();
      await SecureStore.setItemAsync(ENCRYPTION_KEY, key);
    }
    return key;
  } catch (error) {
    console.warn("Failed to get encryption key:", error);
    return "fallback-key-for-demo-only";
  }
}

export async function encrypt(text) {
  if (!text) return null;
  try {
    const key = await getEncryptionKey();
    const encrypted = CryptoJS.AES.encrypt(text, key).toString();
    return encrypted;
  } catch (error) {
    console.warn("Encryption failed:", error);
    return text;
  }
}

export async function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const key = await getEncryptionKey();
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key);
    const originalText = decrypted.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    console.warn("Decryption failed:", error);
    return encryptedText;
  }
}

export async function encryptReminder(reminder) {
  const encrypted = { ...reminder };
  if (reminder.title) {
    encrypted.title = await encrypt(reminder.title);
  }
  if (reminder.description) {
    encrypted.description = await encrypt(reminder.description);
  }
  return encrypted;
}

export async function decryptReminder(reminder) {
  const decrypted = { ...reminder };
  if (reminder.title) {
    decrypted.title = await decrypt(reminder.title);
  }
  if (reminder.description) {
    decrypted.description = await decrypt(reminder.description);
  }
  return decrypted;
}

export async function encryptCredential(value) {
  return await encrypt(value);
}

export async function decryptCredential(encryptedValue) {
  return await decrypt(encryptedValue);
}

export async function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}
