import * as Battery from "expo-battery";

export async function getBatteryLevel() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return Math.round(level * 100);
  } catch (error) {
    console.warn("Failed to get battery level:", error);
    return null;
  }
}

export async function getBatteryState() {
  try {
    const state = await Battery.getBatteryStateAsync();
    return state;
  } catch (error) {
    console.warn("Failed to get battery state:", error);
    return Battery.BatteryState.UNKNOWN;
  }
}

export async function isBatteryLow(threshold = 20) {
  const level = await getBatteryLevel();
  return level !== null && level < threshold;
}

export async function getBatteryInfo() {
  try {
    const level = await getBatteryLevel();
    const state = await getBatteryState();
    return {
      level,
      state,
      isLow: level !== null && level < 20,
      isCharging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL
    };
  } catch (error) {
    console.warn("Failed to get battery info:", error);
    return null;
  }
}

export function subscribeToBatteryState(callback) {
  const subscription = Battery.addBatteryStateListener(({ batteryState }) => {
    callback(batteryState);
  });
  return subscription;
}

export function subscribeToBatteryLevel(callback) {
  const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
    callback(Math.round(batteryLevel * 100));
  });
  return subscription;
}
