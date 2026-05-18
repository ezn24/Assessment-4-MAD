import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as Battery from "expo-battery";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "react-native-maps";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Chip, PaperProvider, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { createReminderDraft } from "./src/models/reminder";
import { theme } from "./src/theme";
import { signInGuest, signOutUser, syncRemindersToFirestore, isFirebaseConfigured } from "./src/services/firebase";
import { deleteReminder, listReminders, seedIfEmpty, upsertReminder } from "./src/services/storage";
import { cancelReminderNotification, configureNotifications, listenForReminderNotifications, scheduleReminder } from "./src/services/notifications";
import { formatCoordinates, getCurrentLocation } from "./src/services/location";
import { registerReminderSweepTask } from "./src/services/backgroundTasks";

const PURPLE = "#4F378B";
const LIGHT_PURPLE = "#EADDFF";
const BG = "#FCF8FF";
const TEXT = "#1D1B20";
const MUTED = "#49454F";
const LINE = "#CAC4D0";
const SURFACE = "#FFFBFE";
const SURFACE_VARIANT = "#F3EDF7";
const ERROR = "#BA1A1A";
const SUCCESS = "#146C2E";

const TABS = [
  ["home", "Home", "bell-outline"],
  ["schedule", "Schedule", "calendar-month-outline"],
  ["map", "Map", "map-marker-radius-outline"],
  ["account", "Account", "account-circle-outline"],
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
  const remindersRef = useRef([]);
  const [tab, setTab] = useState("home");
  const [user, setUser] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [reminding, setReminding] = useState(null);
  const [message, setMessage] = useState("");
  const [battery, setBattery] = useState(null);

  const completedCount = useMemo(() => reminders.filter((item) => item.completed).length, [reminders]);

  async function refresh() {
    const items = await listReminders();
    remindersRef.current = items;
    setReminders(items);
  }

  useEffect(() => {
    async function boot() {
      await seedIfEmpty();
      await configureNotifications().catch(() => {});
      await registerReminderSweepTask().catch(() => {});
      const session = await signInGuest();
      setUser(session.user);
      setBattery(await Battery.getBatteryLevelAsync().catch(() => null));
      await refresh();
    }
    boot().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    return listenForReminderNotifications((reminderId) => {
      const reminder = remindersRef.current.find((item) => item.id === reminderId);
      if (reminder) {
        setReminding(reminder);
      }
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
    await upsertReminder({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      notificationId
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setEditing(null);
    setMessage(notificationId ? "Reminder saved and notification scheduled." : "Reminder saved offline.");
    await refresh();
  }

  async function completeReminder(reminder) {
    await cancelReminderNotification(reminder.notificationId);
    await upsertReminder({ ...reminder, completed: true, notificationId: null });
    setReminding(null);
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
    setMessage(result.skipped ? "Firebase is not configured; offline mode is active." : `Synced ${result.synced} reminders.`);
  }

  if (reminding) {
    return <ReminderPrompt reminder={reminding} onNo={() => setReminding(null)} onYes={() => completeReminder(reminding)} />;
  }

  if (editing) {
    return <ReminderEditor reminder={editing} onChange={setEditing} onSave={() => saveReminder(editing)} onCancel={() => setEditing(null)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader title={getScreenTitle(tab)} />
        <View style={styles.flex}>
          {tab === "home" ? (
            <HomeScreen reminders={reminders} onEdit={(item) => setEditing({ ...item })} onAdd={() => setEditing(createReminderDraft())} onComplete={completeReminder} onDelete={removeReminder} onTest={setReminding} />
          ) : tab === "schedule" ? (
            <ScheduleScreen reminders={reminders} onEdit={(item) => setEditing({ ...item })} />
          ) : tab === "map" ? (
            <MapScreen reminders={reminders} onEdit={(item) => setEditing({ ...item })} />
          ) : tab === "account" ? (
            <AccountScreen user={user} completedCount={completedCount} reminderCount={reminders.length} />
          ) : (
            <SettingsScreen user={user} battery={battery} onSync={syncNow} onSignOut={async () => { await signOutUser(); setUser(null); }} />
          )}
        </View>
        <BottomNav active={tab} onChange={setTab} />
      </KeyboardAvoidingView>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage("")}>{message}</Snackbar>
    </SafeAreaView>
  );
}

function ScreenHeader({ title }) {
  return (
    <View style={styles.header}>
      <Text variant="headlineLarge" style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function HomeScreen({ reminders, onEdit, onAdd, onComplete, onDelete, onTest }) {
  const [query, setQuery] = useState("");
  const visible = reminders.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.homeList}>
        {visible.map((item) => (
          <ReminderRow key={item.id} reminder={item} onPress={() => onEdit(item)} onComplete={() => onComplete(item)} onDelete={() => onDelete(item)} onTest={() => onTest(item)} />
        ))}
      </ScrollView>
      <View style={styles.searchDock}>
        <MaterialCommunityIcons name="magnify" size={30} color={MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search reminders"
          mode="flat"
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          style={styles.searchInput}
        />
        <Pressable style={styles.addButton} onPress={onAdd}>
          <MaterialCommunityIcons name="plus" size={34} color={TEXT} />
        </Pressable>
      </View>
    </View>
  );
}

function ReminderRow({ reminder, onPress, onComplete, onDelete, onTest }) {
  return (
    <Pressable style={styles.reminderRow} onPress={onPress}>
      <VisualCue reminder={reminder} />
      <View style={styles.reminderText}>
        <Text style={styles.taskTime}>{format(parseISO(reminder.scheduledAt), "h:mm a")} · {formatDistanceToNowStrict(parseISO(reminder.scheduledAt), { addSuffix: true })}</Text>
        <Text style={styles.taskTitle}>{reminder.title}</Text>
        <Text style={styles.taskDescription} numberOfLines={1}>{reminder.description || formatCoordinates(reminder)}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable style={styles.iconAction} onPress={onTest}>
          <MaterialCommunityIcons name="play-circle-outline" size={26} color={PURPLE} />
        </Pressable>
        <Pressable style={styles.iconAction} onPress={onComplete}>
          <MaterialCommunityIcons name={reminder.completed ? "check-circle" : "circle-outline"} size={26} color={reminder.completed ? SUCCESS : MUTED} />
        </Pressable>
        <Pressable style={styles.iconAction} onPress={onDelete}>
          <MaterialCommunityIcons name="delete-outline" size={24} color={ERROR} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ScheduleScreen({ reminders, onEdit }) {
  const groups = reminders.reduce((result, item) => {
    const day = format(parseISO(item.scheduledAt), "yyyy/MM/dd");
    result[day] = [...(result[day] || []), item];
    return result;
  }, {});

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      {Object.entries(groups).map(([day, items]) => (
        <View key={day} style={styles.materialPanel}>
          <Text style={styles.panelTitle}>{day}</Text>
          {items.map((item) => (
            <Pressable key={item.id} style={styles.scheduleItem} onPress={() => onEdit(item)}>
              <VisualCue reminder={item} size={42} />
              <View style={styles.flex}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskDescription}>{format(parseISO(item.scheduledAt), "HH:mm")} · {item.completed ? "Completed" : "Pending"}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function MapScreen({ reminders, onEdit }) {
  const located = reminders.filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number");
  const first = located[0] || { latitude: -37.8136, longitude: 144.9631 };

  return (
    <View style={styles.mapPage}>
      <MapView
        style={styles.map}
        initialRegion={{ latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {located.map((item) => (
          <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} title={item.title} description={item.locationLabel || item.description} onCalloutPress={() => onEdit(item)} />
        ))}
      </MapView>
      <View style={styles.mapInfo}>
        <Text style={styles.panelTitle}>Location reminders</Text>
        <Text style={styles.taskDescription}>{located.length ? `${located.length} reminders have GPS context.` : "Attach GPS in Edit Reminder to show markers here."}</Text>
      </View>
    </View>
  );
}

function AccountScreen({ user, completedCount, reminderCount }) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.accountCard}>
        <View style={styles.avatarCircle}>
          <MaterialCommunityIcons name="account-outline" size={48} color={PURPLE} />
        </View>
        <View>
          <Text style={styles.accountName}>User</Text>
          <Text style={styles.accountSub}>{user?.uid || "Offline local account"}</Text>
        </View>
      </View>
      <View style={styles.materialPanel}>
        <Text style={styles.panelTitle}>Progress</Text>
        <Text style={styles.bigMetric}>{completedCount}/{reminderCount}</Text>
        <Text style={styles.taskDescription}>Completed reminders are stored locally and can sync to Firestore when configured.</Text>
      </View>
    </ScrollView>
  );
}

function SettingsScreen({ user, battery, onSync, onSignOut }) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <SettingsRow icon="firebase" title="Firebase" body={`Auth: ${user?.uid || "not signed in"} · ${isFirebaseConfigured() ? "Firestore enabled" : "Offline mode"}`} />
      <SettingsRow icon="database-outline" title="SQLite storage" body="Reminders are stored in a local relational database for reliable offline use." />
      <SettingsRow icon="battery-70" title="Battery" body={battery == null ? "Battery unavailable" : `Battery level ${Math.round(battery * 100)}%`} />
      <SettingsRow icon="sync" title="Background task" body="A background sweep task checks due reminders." />
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
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.72 });
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader title="Edit Task" />
        <ScrollView contentContainerStyle={styles.editContent}>
          <View style={styles.editorHero}>
            <VisualCue reminder={reminder} size={120} />
            <Pressable style={styles.heroEditButton} onPress={pickImage}>
              <MaterialCommunityIcons name="pencil-outline" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <EditField label="Title" value={reminder.title} onChangeText={(title) => onChange({ ...reminder, title })} />
          <EditField label="Description" value={reminder.description} onChangeText={(description) => onChange({ ...reminder, description })} multiline optional />
          <EditField label="Time" value={format(parseISO(reminder.scheduledAt), "HH:mm")} onChangeText={() => {}} locked />
          <EditField label="Date" value={format(parseISO(reminder.scheduledAt), "yyyy/MM/dd")} onChangeText={() => {}} locked />
          <EditField label="Emoji" value={reminder.emoji || ""} onChangeText={(emoji) => onChange({ ...reminder, visualType: "emoji", emoji })} optional />
          <EditField label="Location" value={reminder.locationLabel || ""} onChangeText={(locationLabel) => onChange({ ...reminder, locationLabel })} optional />

          <Pressable style={styles.gpsButton} onPress={attachLocation}>
            <MaterialCommunityIcons name="crosshairs-gps" size={24} color={PURPLE} />
            <Text style={styles.gpsText}>{formatCoordinates(reminder)}</Text>
          </Pressable>

          <View style={styles.switchLine}>
            <Text style={styles.panelTitle}>Important reminder</Text>
            <Switch value={reminder.important} color={PURPLE} onValueChange={(important) => onChange({ ...reminder, important })} />
          </View>
        </ScrollView>
        <View style={styles.editorFooter}>
          <Button mode="contained" onPress={onSave}>Save</Button>
          <Button mode="outlined" onPress={onCancel}>Cancel</Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EditField({ label, value, onChangeText, multiline = false, optional = false, locked = false }) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={optional ? "Optional" : "Required"}
        mode="flat"
        multiline={multiline}
        editable={!locked}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        style={styles.editInput}
      />
    </View>
  );
}

function ReminderPrompt({ reminder, onNo, onYes }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.prompt}>
        <Text variant="headlineLarge" style={styles.headerTitle}>VizMinder</Text>
        <VisualCue reminder={reminder} size={128} />
        <Text style={styles.promptTime}>It is {format(parseISO(reminder.scheduledAt), "HH:mm")} now !</Text>
        <Text style={styles.promptQuestion}>Have you completed {reminder.title}?</Text>
        <View style={styles.promptActions}>
          <Pressable style={[styles.promptButton, styles.promptNo]} onPress={onNo}>
            <MaterialCommunityIcons name="close" size={54} color="#FFFFFF" />
          </Pressable>
          <Pressable style={[styles.promptButton, styles.promptYes]} onPress={onYes}>
            <MaterialCommunityIcons name="check" size={54} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, title, body }) {
  return (
    <View style={styles.settingsRow}>
      <MaterialCommunityIcons name={icon} size={30} color={MUTED} />
      <View style={styles.flex}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsBody}>{body}</Text>
      </View>
    </View>
  );
}

function VisualCue({ reminder, size = 54 }) {
  const contentSize = Math.round(size * 0.48);
  if (reminder.visualType === "image" && reminder.imageUri) {
    return <Image source={{ uri: reminder.imageUri }} style={[styles.visualCue, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.visualCue, { width: size, height: size, borderRadius: size / 2 }]}>
      {reminder.visualType === "emoji" ? (
        <Text style={{ fontSize: contentSize, lineHeight: size, includeFontPadding: false }}>{reminder.emoji || "🔔"}</Text>
      ) : (
        <MaterialCommunityIcons name={reminder.icon || "bell-outline"} size={contentSize} color={PURPLE} />
      )}
    </View>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <View style={styles.bottomNav}>
      {TABS.map(([key, label, icon]) => (
        <Pressable key={key} style={styles.navItem} onPress={() => onChange(key)}>
          <View style={[styles.navPill, active === key && styles.navPillActive]}>
            <MaterialCommunityIcons name={icon} size={25} color={active === key ? TEXT : MUTED} />
          </View>
          <Text style={[styles.navLabel, active === key && styles.navLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function getScreenTitle(tab) {
  return TABS.find(([key]) => key === tab)?.[1] || "VizMinder";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: BG, flex: 1 },
  header: { alignItems: "center", paddingTop: 22, paddingBottom: 18 },
  headerTitle: { color: TEXT, fontWeight: "400" },
  homeList: { paddingBottom: 188 },
  reminderRow: {
    alignItems: "center",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 16,
    minHeight: 112,
    paddingHorizontal: 22,
    paddingVertical: 16
  },
  reminderText: { flex: 1, minWidth: 0 },
  taskTime: { color: MUTED, fontSize: 16, fontWeight: "700" },
  taskTitle: { color: TEXT, fontSize: 22, fontWeight: "500" },
  taskDescription: { color: MUTED, fontSize: 16, lineHeight: 22 },
  rowActions: { alignItems: "center", flexDirection: "row", gap: 4 },
  iconAction: { padding: 5 },
  searchDock: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 20,
    bottom: 94,
    flexDirection: "row",
    gap: 10,
    height: 82,
    left: 22,
    paddingLeft: 20,
    paddingRight: 10,
    position: "absolute",
    right: 22
  },
  searchInput: { backgroundColor: "transparent", flex: 1, height: 52 },
  addButton: {
    alignItems: "center",
    backgroundColor: LIGHT_PURPLE,
    borderRadius: 18,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderTopColor: "#E7E0EC",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 8,
    paddingTop: 8
  },
  navItem: { alignItems: "center", flex: 1, gap: 2 },
  navPill: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 5 },
  navPillActive: { backgroundColor: LIGHT_PURPLE },
  navLabel: { color: MUTED, fontSize: 11, fontWeight: "700" },
  navLabelActive: { color: TEXT },
  visualCue: {
    alignItems: "center",
    backgroundColor: LIGHT_PURPLE,
    justifyContent: "center",
    overflow: "hidden"
  },
  pageContent: { gap: 14, paddingHorizontal: 22, paddingBottom: 120 },
  materialPanel: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 16
  },
  panelTitle: { color: TEXT, fontSize: 20, fontWeight: "600" },
  scheduleItem: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 8 },
  mapPage: { flex: 1, paddingHorizontal: 22, paddingBottom: 24 },
  map: { borderRadius: 8, flex: 1, overflow: "hidden" },
  mapInfo: { backgroundColor: SURFACE, borderRadius: 8, marginTop: 12, padding: 14 },
  accountCard: { alignItems: "center", flexDirection: "row", gap: 18, paddingVertical: 20 },
  avatarCircle: { alignItems: "center", backgroundColor: LIGHT_PURPLE, borderRadius: 42, height: 84, justifyContent: "center", width: 84 },
  accountName: { color: TEXT, fontSize: 24, fontWeight: "700" },
  accountSub: { color: MUTED, fontSize: 14 },
  bigMetric: { color: PURPLE, fontSize: 54, fontWeight: "800" },
  settingsRow: { alignItems: "flex-start", borderBottomColor: LINE, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 18, paddingVertical: 18 },
  settingsTitle: { color: TEXT, fontSize: 22, fontWeight: "500" },
  settingsBody: { color: MUTED, fontSize: 16, lineHeight: 23 },
  editContent: { gap: 18, paddingHorizontal: 18, paddingBottom: 150 },
  editorHero: { alignItems: "center", alignSelf: "center", marginBottom: 8 },
  heroEditButton: { alignItems: "center", backgroundColor: PURPLE, borderRadius: 28, bottom: 0, height: 54, justifyContent: "center", position: "absolute", right: -8, width: 54 },
  editField: { alignItems: "center", borderColor: LINE, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 74, paddingHorizontal: 16 },
  editLabel: { color: TEXT, fontSize: 18, fontWeight: "700", width: 100 },
  editInput: { backgroundColor: SURFACE_VARIANT, borderRadius: 16, flex: 1, fontSize: 18 },
  gpsButton: { alignItems: "center", backgroundColor: SURFACE_VARIANT, borderRadius: 18, flexDirection: "row", gap: 12, padding: 16 },
  gpsText: { color: MUTED, flex: 1, fontSize: 16 },
  switchLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 },
  editorFooter: { alignItems: "center", borderTopColor: LINE, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, justifyContent: "flex-end", padding: 16 },
  prompt: { alignItems: "center", flex: 1, justifyContent: "center", gap: 44, padding: 28 },
  promptTime: { color: PURPLE, fontSize: 42, fontWeight: "800", textAlign: "center" },
  promptQuestion: { color: PURPLE, fontSize: 34, fontWeight: "800", textAlign: "center" },
  promptActions: { flexDirection: "row", gap: 52, marginTop: 20 },
  promptButton: { alignItems: "center", borderRadius: 86, height: 144, justifyContent: "center", width: 144 },
  promptNo: { backgroundColor: PURPLE },
  promptYes: { backgroundColor: "#BDAAF7" }
});
