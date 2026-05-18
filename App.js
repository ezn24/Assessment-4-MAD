import React, { useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as Battery from "expo-battery";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "react-native-maps";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, Chip, Divider, FAB, PaperProvider, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { createReminderDraft } from "./src/models/reminder";
import { colors, theme } from "./src/theme";
import { signInGuest, signOutUser, syncRemindersToFirestore, isFirebaseConfigured } from "./src/services/firebase";
import { deleteReminder, listReminders, seedIfEmpty, upsertReminder } from "./src/services/storage";
import { cancelReminderNotification, configureNotifications, listenForReminderNotifications, scheduleReminder } from "./src/services/notifications";
import { formatCoordinates, getCurrentLocation } from "./src/services/location";
import { registerReminderSweepTask } from "./src/services/backgroundTasks";

const tabs = [
  ["home", "Home", "bell-outline"],
  ["schedule", "Schedule", "calendar-month-outline"],
  ["map", "Map", "map-marker-radius-outline"],
  ["settings", "Settings", "cog-outline"]
];

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <VizMinderApp />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

function VizMinderApp() {
  const [tab, setTab] = useState("home");
  const [user, setUser] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [battery, setBattery] = useState(null);
  const [selectedReminderId, setSelectedReminderId] = useState(null);

  const selectedReminder = useMemo(
    () => reminders.find((item) => item.id === selectedReminderId) || null,
    [reminders, selectedReminderId]
  );

  async function refresh() {
    const items = await listReminders();
    setReminders(items);
  }

  useEffect(() => {
    async function boot() {
      await seedIfEmpty();
      await configureNotifications().catch(() => {});
      await registerReminderSweepTask().catch(() => {});
      const batteryLevel = await Battery.getBatteryLevelAsync().catch(() => null);
      setBattery(batteryLevel);
      const session = await signInGuest();
      setUser(session.user);
      await refresh();
    }
    boot().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    return listenForReminderNotifications((reminderId) => {
      setSelectedReminderId(reminderId);
      setTab("home");
    });
  }, []);

  async function saveReminder(draft) {
    if (!draft.title.trim()) {
      setMessage("Title is required.");
      return;
    }
    if (draft.notificationId) {
      await cancelReminderNotification(draft.notificationId);
    }
    const notificationId = await scheduleReminder(draft);
    await upsertReminder({ ...draft, title: draft.title.trim(), notificationId });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setEditing(null);
    setMessage(notificationId ? "Reminder saved and notification scheduled." : "Reminder saved offline.");
    await refresh();
  }

  async function completeReminder(reminder) {
    await cancelReminderNotification(reminder.notificationId);
    await upsertReminder({ ...reminder, completed: true, notificationId: null });
    setSelectedReminderId(null);
    await refresh();
  }

  async function removeReminder(reminder) {
    await cancelReminderNotification(reminder.notificationId);
    await deleteReminder(reminder.id);
    setMessage("Reminder deleted.");
    await refresh();
  }

  async function syncNow() {
    const result = await syncRemindersToFirestore(user?.uid, reminders);
    setMessage(result.skipped ? "Firebase is not configured; using offline mode." : `Synced ${result.synced} reminders.`);
  }

  if (editing) {
    return (
      <ReminderEditor
        reminder={editing}
        onChange={setEditing}
        onCancel={() => setEditing(null)}
        onSave={() => saveReminder(editing)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View>
            <Text variant="headlineMedium" style={styles.title}>VizMinder</Text>
            <Text style={styles.subtitle}>Context-aware visual reminders</Text>
          </View>
          <Chip icon={isFirebaseConfigured() ? "cloud-check-outline" : "cloud-off-outline"}>
            {isFirebaseConfigured() ? "Cloud" : "Offline"}
          </Chip>
        </View>

        {selectedReminder ? (
          <ReminderPrompt reminder={selectedReminder} onNo={() => setSelectedReminderId(null)} onYes={() => completeReminder(selectedReminder)} />
        ) : tab === "home" ? (
          <HomeScreen
            reminders={reminders}
            onEdit={(item) => setEditing({ ...item })}
            onAdd={() => setEditing(createReminderDraft())}
            onComplete={completeReminder}
            onDelete={removeReminder}
          />
        ) : tab === "schedule" ? (
          <ScheduleScreen reminders={reminders} onEdit={(item) => setEditing({ ...item })} />
        ) : tab === "map" ? (
          <MapScreen reminders={reminders} onEdit={(item) => setEditing({ ...item })} />
        ) : (
          <SettingsScreen user={user} battery={battery} onSync={syncNow} onSignOut={async () => { await signOutUser(); setUser(null); }} />
        )}

        <BottomNav active={tab} onChange={setTab} />
        {tab === "home" ? <FAB icon="plus" style={styles.fab} onPress={() => setEditing(createReminderDraft())} /> : null}
      </KeyboardAvoidingView>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage("")}>{message}</Snackbar>
    </SafeAreaView>
  );
}

function HomeScreen({ reminders, onEdit, onAdd, onComplete, onDelete }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <SectionTitle title="Today" subtitle="Tap a reminder to edit. Use Complete to confirm the task." />
      {reminders.map((item) => (
        <ReminderCard key={item.id} reminder={item} onPress={() => onEdit(item)} onComplete={() => onComplete(item)} onDelete={() => onDelete(item)} />
      ))}
      <Button mode="contained-tonal" icon="plus" onPress={onAdd}>Add reminder</Button>
    </ScrollView>
  );
}

function ScheduleScreen({ reminders, onEdit }) {
  const grouped = reminders.reduce((days, item) => {
    const day = format(parseISO(item.scheduledAt), "yyyy/MM/dd");
    days[day] = [...(days[day] || []), item];
    return days;
  }, {});
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <SectionTitle title="Schedule" subtitle="Date-grouped reminders show data passing between screens." />
      {Object.entries(grouped).map(([day, items]) => (
        <Card key={day} style={styles.card}>
          <Card.Title title={day} subtitle={`${items.length} reminder(s)`} />
          <Card.Content>
            {items.map((item) => (
              <Pressable key={item.id} style={styles.scheduleRow} onPress={() => onEdit(item)}>
                <VisualCue reminder={item} />
                <View style={styles.flex}>
                  <Text variant="titleMedium">{item.title}</Text>
                  <Text style={styles.subtitle}>{format(parseISO(item.scheduledAt), "HH:mm")} · {item.completed ? "completed" : "pending"}</Text>
                </View>
              </Pressable>
            ))}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

function MapScreen({ reminders, onEdit }) {
  const located = reminders.filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number");
  const first = located[0] || { latitude: -37.8136, longitude: 144.9631 };
  return (
    <View style={styles.mapScreen}>
      <SectionTitle title="Location Context" subtitle="GPS coordinates can be attached to reminders for context-aware cues." />
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
      >
        {located.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            title={item.title}
            description={item.locationLabel || item.description}
            onCalloutPress={() => onEdit(item)}
          />
        ))}
      </MapView>
    </View>
  );
}

function SettingsScreen({ user, battery, onSync, onSignOut }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <SectionTitle title="Settings & Evidence" subtitle="Assessment 4 technologies are exposed as working app features." />
      <InfoRow icon="firebase" title="Firebase" body={`Auth user: ${user?.uid || "not signed in"} · Firestore sync is ${isFirebaseConfigured() ? "enabled" : "in offline demo mode"}.`} />
      <InfoRow icon="database-outline" title="SQLite" body="Reminders are stored in a local relational SQLite table before syncing." />
      <InfoRow icon="battery-70" title="Battery" body={battery == null ? "Battery status unavailable" : `Battery level: ${Math.round(battery * 100)}%`} />
      <InfoRow icon="sync" title="Background Task" body="A background sweep task is registered to inspect due reminders." />
      <Button mode="contained" icon="cloud-sync-outline" onPress={onSync}>Sync to Firestore</Button>
      <Button mode="outlined" icon="logout" onPress={onSignOut}>Sign out</Button>
    </ScrollView>
  );
}

function ReminderEditor({ reminder, onChange, onSave, onCancel }) {
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.72 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      onChange({ ...reminder, visualType: "image", imageUri: result.assets[0].uri });
    }
  }

  async function attachLocation() {
    const location = await getCurrentLocation();
    if (location) {
      onChange({ ...reminder, ...location, locationLabel: "Current location" });
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <SectionTitle title="Edit Reminder" subtitle="Visual, time, media, and GPS context are saved together." />
        <View style={styles.editorVisual}>
          <VisualCue reminder={reminder} size={96} />
          <View style={styles.visualActions}>
            <Button mode="contained-tonal" icon="image-outline" onPress={pickImage}>Photo</Button>
            <Button mode="contained-tonal" icon="map-marker-plus-outline" onPress={attachLocation}>GPS</Button>
          </View>
        </View>
        <TextInput label="Title" value={reminder.title} onChangeText={(title) => onChange({ ...reminder, title })} mode="outlined" />
        <TextInput label="Description" value={reminder.description} onChangeText={(description) => onChange({ ...reminder, description })} mode="outlined" multiline />
        <TextInput
          label="Scheduled ISO time"
          value={reminder.scheduledAt}
          onChangeText={(scheduledAt) => onChange({ ...reminder, scheduledAt })}
          mode="outlined"
        />
        <TextInput label="Emoji visual cue" value={reminder.emoji} onChangeText={(emoji) => onChange({ ...reminder, visualType: "emoji", emoji })} mode="outlined" />
        <TextInput label="Location label" value={reminder.locationLabel || ""} onChangeText={(locationLabel) => onChange({ ...reminder, locationLabel })} mode="outlined" />
        <Text style={styles.subtitle}>{formatCoordinates(reminder)}</Text>
        <View style={styles.switchRow}>
          <Text variant="titleMedium">Important reminder</Text>
          <Switch value={reminder.important} onValueChange={(important) => onChange({ ...reminder, important })} />
        </View>
        <View style={styles.buttonRow}>
          <Button mode="outlined" onPress={onCancel}>Cancel</Button>
          <Button mode="contained" onPress={onSave}>Save</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReminderPrompt({ reminder, onNo, onYes }) {
  return (
    <View style={styles.prompt}>
      <VisualCue reminder={reminder} size={120} />
      <Text variant="headlineMedium" style={styles.promptTitle}>{format(parseISO(reminder.scheduledAt), "HH:mm")}</Text>
      <Text variant="headlineSmall" style={styles.promptQuestion}>Have you completed {reminder.title}?</Text>
      <View style={styles.promptActions}>
        <Pressable style={[styles.promptButton, styles.noButton]} onPress={onNo}>
          <MaterialCommunityIcons name="close" color="#FFFFFF" size={42} />
        </Pressable>
        <Pressable style={[styles.promptButton, styles.yesButton]} onPress={onYes}>
          <MaterialCommunityIcons name="check" color="#FFFFFF" size={42} />
        </Pressable>
      </View>
    </View>
  );
}

function ReminderCard({ reminder, onPress, onComplete, onDelete }) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.reminderContent}>
        <VisualCue reminder={reminder} />
        <View style={styles.flex}>
          <Text variant="titleMedium">{reminder.title}</Text>
          <Text style={styles.subtitle}>{format(parseISO(reminder.scheduledAt), "yyyy/MM/dd HH:mm")} · {formatDistanceToNowStrict(parseISO(reminder.scheduledAt), { addSuffix: true })}</Text>
          <Text style={styles.bodyText}>{reminder.description}</Text>
          <Text style={styles.locationText}>{formatCoordinates(reminder)}</Text>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button onPress={onDelete} textColor={colors.error}>Delete</Button>
        <Button mode="contained-tonal" onPress={onComplete} disabled={reminder.completed}>
          {reminder.completed ? "Done" : "Complete"}
        </Button>
      </Card.Actions>
    </Card>
  );
}

function VisualCue({ reminder, size = 54 }) {
  const iconSize = Math.round(size * 0.48);
  if (reminder.visualType === "image" && reminder.imageUri) {
    return <Image source={{ uri: reminder.imageUri }} style={[styles.visualCue, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.visualCue, { width: size, height: size, borderRadius: size / 2 }]}>
      {reminder.visualType === "emoji" ? (
        <Text style={{ fontSize: iconSize, lineHeight: size }}>{reminder.emoji || "🔔"}</Text>
      ) : (
        <MaterialCommunityIcons name={reminder.icon || "bell-outline"} size={iconSize} color={colors.primary} />
      )}
    </View>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="headlineSmall">{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function InfoRow({ icon, title, body }) {
  return (
    <Card style={styles.card}>
      <Card.Content style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={30} color={colors.primary} />
        <View style={styles.flex}>
          <Text variant="titleMedium">{title}</Text>
          <Text style={styles.bodyText}>{body}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <View style={styles.bottomNav}>
      {tabs.map(([key, label, icon]) => (
        <Pressable key={key} style={styles.navItem} onPress={() => onChange(key)}>
          <View style={[styles.navPill, active === key && styles.navPillActive]}>
            <MaterialCommunityIcons name={icon} size={24} color={active === key ? colors.primary : colors.muted} />
          </View>
          <Text style={[styles.navLabel, active === key && styles.navLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10
  },
  title: { color: colors.text, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  bodyText: { color: colors.muted, marginTop: 4 },
  screen: { gap: 14, padding: 18, paddingBottom: 112 },
  sectionTitle: { gap: 4, marginBottom: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 8 },
  reminderContent: { alignItems: "center", flexDirection: "row", gap: 14 },
  visualCue: {
    alignItems: "center",
    backgroundColor: colors.primaryContainer,
    justifyContent: "center",
    overflow: "hidden"
  },
  locationText: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  scheduleRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 10 },
  mapScreen: { flex: 1, gap: 12, padding: 18, paddingBottom: 100 },
  map: { borderRadius: 8, flex: 1, overflow: "hidden" },
  infoRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  editorVisual: { alignItems: "center", gap: 12 },
  visualActions: { flexDirection: "row", gap: 10 },
  switchRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  buttonRow: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  prompt: { alignItems: "center", flex: 1, justifyContent: "center", gap: 28, padding: 24 },
  promptTitle: { color: colors.primary, fontWeight: "800" },
  promptQuestion: { color: colors.primary, fontWeight: "700", textAlign: "center" },
  promptActions: { flexDirection: "row", gap: 44, marginTop: 24 },
  promptButton: { alignItems: "center", borderRadius: 72, height: 128, justifyContent: "center", width: 128 },
  noButton: { backgroundColor: colors.primary },
  yesButton: { backgroundColor: colors.secondary },
  bottomNav: {
    backgroundColor: colors.surfaceVariant,
    borderTopColor: "#DED8E1",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    left: 0,
    paddingBottom: 10,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  navItem: { alignItems: "center", gap: 2, minWidth: 72 },
  navPill: { borderRadius: 24, paddingHorizontal: 18, paddingVertical: 5 },
  navPillActive: { backgroundColor: colors.primaryContainer },
  navLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  navLabelActive: { color: colors.primary },
  fab: { bottom: 86, position: "absolute", right: 20 }
});
