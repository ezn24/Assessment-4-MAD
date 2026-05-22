import * as LocalAuthentication from "expo-local-authentication";

export async function isBiometricAvailable() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return {
      available: compatible && enrolled,
      compatible,
      enrolled,
      message: compatible && enrolled ? "Biometric authentication available" : "Biometric authentication not available or not enrolled"
    };
  } catch (error) {
    console.warn("Failed to check biometric availability:", error);
    return { available: false, compatible: false, enrolled: false, message: "Error checking biometric availability" };
  }
}

export async function authenticateBiometric(promptMessage = "Authenticate to access reminders") {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use passcode",
      cancelLabel: "Cancel",
      disableDeviceFallback: false
    });
    return {
      success: result.success,
      error: result.error,
      warning: result.warning
    };
  } catch (error) {
    console.warn("Biometric authentication failed:", error);
    return { success: false, error: error.message };
  }
}

export async function getSupportedAuthenticationTypes() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types;
  } catch (error) {
    console.warn("Failed to get supported authentication types:", error);
    return [];
  }
}

export async function getAuthenticationTypeLabel() {
  const types = await getSupportedAuthenticationTypes();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "Face ID";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }
  return "Biometric";
}
