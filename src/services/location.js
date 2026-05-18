import * as Location from "expo-location";

export async function getCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;
  return { latitude, longitude };
}

export function formatCoordinates(reminder) {
  if (typeof reminder.latitude !== "number" || typeof reminder.longitude !== "number") {
    return "No location attached";
  }
  return `${reminder.latitude.toFixed(5)}, ${reminder.longitude.toFixed(5)}`;
}
