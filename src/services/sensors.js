import { Platform } from "react-native";

let Accelerometer, Gyroscope, Torch;

if (Platform.OS !== "web") {
  try {
    const sensors = require("expo-sensors");
    Accelerometer = sensors.Accelerometer;
    Gyroscope = sensors.Gyroscope;
    Torch = require("expo-torch");
  } catch (e) {
    console.warn("Sensors not available:", e);
  }
}

export async function getAccelerometerData() {
  if (!Accelerometer) {
    return null;
  }
  const isAvailable = await Accelerometer.isAvailableAsync();
  if (!isAvailable) {
    return null;
  }
  return new Promise((resolve) => {
    const subscription = Accelerometer.addListener((data) => {
      subscription.remove();
      resolve(data);
    });
    Accelerometer.setUpdateInterval(1000);
  });
}

export async function getGyroscopeData() {
  if (!Gyroscope) {
    return null;
  }
  const isAvailable = await Gyroscope.isAvailableAsync();
  if (!isAvailable) {
    return null;
  }
  return new Promise((resolve) => {
    const subscription = Gyroscope.addListener((data) => {
      subscription.remove();
      resolve(data);
    });
    Gyroscope.setUpdateInterval(1000);
  });
}

// expo-torch's actual API only exposes isAvailableAsync() and setStateAsync(on).
// We track on/off state locally because the module has no getter.
let torchState = false;

export async function isTorchAvailable() {
  if (!Torch) {
    return false;
  }
  return await Torch.isAvailableAsync();
}

export async function getTorchAvailability() {
  if (!Torch) {
    return { available: false, message: "Torch not available on this device" };
  }
  const isAvailable = await Torch.isAvailableAsync();
  if (!isAvailable) {
    return { available: false, message: "Torch not available on this device" };
  }
  return { available: true, message: "Torch available" };
}

export async function toggleTorch() {
  if (!Torch) {
    throw new Error("Torch not available on this device");
  }
  const isAvailable = await Torch.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Torch not available on this device");
  }
  const next = !torchState;
  await Torch.setStateAsync(next);
  torchState = next;
  return next;
}

export async function setTorchState(turnOn) {
  if (!Torch) {
    throw new Error("Torch not available on this device");
  }
  const isAvailable = await Torch.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Torch not available on this device");
  }
  await Torch.setStateAsync(Boolean(turnOn));
  torchState = Boolean(turnOn);
  return torchState;
}

export function getTorchState() {
  return torchState;
}
