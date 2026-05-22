import { Accelerometer, Gyroscope } from "expo-sensors";
import * as Torch from "expo-torch";

export async function getAccelerometerData() {
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

export async function isTorchAvailable() {
  return await Torch.isAvailableAsync();
}

export async function getTorchAvailability() {
  const isAvailable = await Torch.isAvailableAsync();
  if (!isAvailable) {
    return { available: false, message: "Torch not available on this device" };
  }
  return { available: true, message: "Torch available" };
}

export async function toggleTorch() {
  const isAvailable = await Torch.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Torch not available on this device");
  }
  const currentState = await Torch.getStateAsync();
  if (currentState.isAvailable) {
    await Torch.toggleAvailableAsync();
    return !currentState.isAvailable;
  }
  return false;
}

export async function setTorchState(turnOn) {
  const isAvailable = await Torch.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Torch not available on this device");
  }
  await Torch.toggleAvailableAsync(turnOn);
  return turnOn;
}
