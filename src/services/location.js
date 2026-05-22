import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

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

export function LocationMap({ location, reminders = [], style }) {
  if (!location || !location.latitude || !location.longitude) {
    return null;
  }

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={style}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      }}
      showsUserLocation={true}
      showsMyLocationButton={true}
    >
      <Marker
        coordinate={{
          latitude: location.latitude,
          longitude: location.longitude
        }}
        title="Current Location"
        description="You are here"
        pinColor="#007AFF"
      />
      {reminders
        .filter((r) => r.latitude && r.longitude)
        .map((reminder) => (
          <Marker
            key={reminder.id}
            coordinate={{
              latitude: reminder.latitude,
              longitude: reminder.longitude
            }}
            title={reminder.title}
            description={reminder.description || "Reminder location"}
            pinColor="#FF3B30"
          />
        ))}
    </MapView>
  );
}
