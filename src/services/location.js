import { Platform, View, Text } from "react-native";

let Location = null;
let MapView = null;
let Marker = null;
let PROVIDER_GOOGLE = null;

if (Platform.OS !== "web") {
  try {
    Location = require("expo-location");
  } catch (e) {
    console.warn("Location not available:", e);
  }
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn("Maps not available:", e);
  }
}

export async function getCurrentLocation() {
  if (Platform.OS === "web" || !Location) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          console.warn("Web geolocation failed:", err && err.message);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }
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
  if (Platform.OS === "web" || !MapView) {
    if (!location || !location.latitude || !location.longitude) {
      return (
        <View style={[style, { justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" }]}>
          <Text>Location not available</Text>
        </View>
      );
    }
    return (
      <View style={[style, { justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" }]}>
        <Text style={{ fontSize: 16, marginBottom: 8 }}>Current Location</Text>
        <Text style={{ fontSize: 14, color: "#666" }}>
          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </Text>
        <Text style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
          Open in map: <Text style={{ color: "#007AFF", textDecorationLine: "underline" }}>
            https://maps.google.com/?q={location.latitude},{location.longitude}
          </Text>
        </Text>
      </View>
    );
  }

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
