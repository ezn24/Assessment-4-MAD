import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Animatable from "react-native-animatable";
import Svg, { Circle } from "react-native-svg";
// expo-haptics adds native tactile feedback to completion, toggle, and delete actions.
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
// expo-notifications schedules real local notifications when reminder time arrives.
import * as Notifications from "expo-notifications";
// Native date/time picker is kept as an escape hatch beside the custom Material-style picker.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { format, formatDistanceStrict, isValid, parseISO, set } from "date-fns";
import { Calendar } from "react-native-calendars";
import { Button, Divider, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { useReminders } from "../hooks/useReminders";
import {
  fetchRemindersFromFirestore,
  getFirebaseServices,
  listenToAuthState,
  loginWithEmail,
  registerWithEmail,
  signOutUser
} from "../services/firebase";
import { cancelNativeAlarm, scheduleNativeAlarm } from "../services/nativeAlarm";

const PURPLE = "#4F378B";
const LIGHT_PURPLE = "#EADDFF";
const BG = "#FCF8FF";
const TEXT = "#1D1B20";
const MUTED = "#49454F";
const LINE = "#CAC4D0";
const SURFACE = "#FFFBFE";
const SURFACE_VARIANT = "#F3EDF7";
const PRIMARY_CONTAINER = "#EADDFF";
const ERROR = "#BA1A1A";
const SUCCESS = "#146C2E";
const DATE_DISPLAY_FORMAT = "yyyy/MM/dd";
const DATE_INPUT_PLACEHOLDER = "yyyy/mm/dd";
const REMINDER_CHANNEL_ID = "vizminder-a4-reminders";
const DEFAULT_SETTINGS = {
  themeMode: "light",
  followSystemColors: true,
  showReminderDebugButton: false,
  recordDebugPromptStats: false,
  reminderNotifications: true,
  notificationSound: true,
  fullScreenAlerts: true,
  followUpNotifications: true,
  notificationVibration: true
};
const RINGTONE_OPTIONS = [
  ["alarm", "System alarm"],
  ["notification", "Notification tone"],
  ["ringtone", "Phone ringtone"],
  ["silent", "Silent visual only"]
];
const TAB_ORDER = ["home", "schedule", "stats", "account", "settings"];
const FOLLOW_UP_COUNTS = [0, 1, 2, 3, 5, 10];
const FOLLOW_UP_INTERVALS = [1, 3, 5, 10, 15, 30];
const FONT_REGULAR = Platform.OS === "android" ? "Roboto_400Regular" : undefined;
const FONT_MEDIUM = Platform.OS === "android" ? "Roboto_500Medium" : undefined;
const FONT_SEMIBOLD = Platform.OS === "android" ? "Roboto_500Medium" : undefined;
const FONT_BOLD = Platform.OS === "android" ? "Roboto_700Bold" : undefined;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});
const ICON_OPTIONS = [
  "bell-outline",
  "key",
  "fire",
  "tshirt-crew",
  "pill",
  "wallet-outline",
  "shoe-sneaker",
  "book-open-page-variant",
  "water",
  "food-apple-outline",
  "coffee-outline",
  "toothbrush-paste",
  "trash-can-outline",
  "email-outline",
  "phone-outline",
  "cart-outline",
  "home-outline",
  "briefcase-outline",
  "calendar-check-outline",
  "run",
  "bed-outline",
  "car-outline",
  "umbrella-outline",
  "lightbulb-outline"
];
const EMOJI_OPTIONS = [
  "\u{1F514}",
  "\u{1F511}",
  "\u{1F525}",
  "\u{1F48A}",
  "\u{1F455}",
  "\u{1F45F}",
  "\u{1F4DA}",
  "\u{1F34E}",
  "\u{1F4A7}",
  "\u{2615}",
  "\u{1FAA5}",
  "\u{1F5D1}\u{FE0F}",
  "\u{2709}\u{FE0F}",
  "\u{1F4F1}",
  "\u{1F6D2}",
  "\u{1F3E0}",
  "\u{1F4BC}",
  "\u{2705}",
  "\u{1F3C3}",
  "\u{1F6CF}\u{FE0F}",
  "\u{1F697}",
  "\u{2602}\u{FE0F}",
  "\u{1F4A1}",
  "\u{1F9D8}"
];

function getPalette(themeColors = {}, isDark = false) {
  return {
    primary: themeColors.primary || PURPLE,
    onPrimary: themeColors.onPrimary || "#FFFFFF",
    primaryContainer: themeColors.primaryContainer || (isDark ? "#6750A4" : PRIMARY_CONTAINER),
    onPrimaryContainer: themeColors.onPrimaryContainer || (isDark ? "#EADDFF" : "#21005D"),
    background: themeColors.background || (isDark ? "#141218" : BG),
    surface: themeColors.surface || (isDark ? "#141218" : SURFACE),
    surfaceVariant: themeColors.surfaceVariant || (isDark ? "#49454F" : SURFACE_VARIANT),
    onSurface: themeColors.onSurface || (isDark ? "#E6E0E9" : TEXT),
    onSurfaceVariant: themeColors.onSurfaceVariant || (isDark ? "#CAC4D0" : MUTED),
    outline: themeColors.outline || (isDark ? "#938F99" : LINE),
    error: themeColors.error || ERROR
  };
}

function createDraftReminder() {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}`,
    title: "",
    description: "",
    visualCue: "Photo or icon cue",
    visualType: "icon",
    icon: "bell-outline",
    emoji: "\u{1F514}",
    scheduledAt: now,
    createdAt: now,
    timeSet: true,
    hasDate: false,
    repeat: false,
    repeatUntil: null,
    followUpEnabled: false,
    followUpCount: 0,
    followUpIntervalMinutes: 5,
    promptYesCount: 0,
    promptNoCount: 0,
    promptConfirmedCount: 0,
    ringtone: "alarm",
    important: true,
    completed: false,
    imageUri: null,
    streak: 0
  };
}

export default function HomeScreen({ settings: appSettings = DEFAULT_SETTINGS, onUpdateSettings, isDarkOverride = null, themeColors = {} }) {
  const { reminders, markedDates, updateReminder, addReminder, deleteReminder, resetPrototype, resetStats, refreshFromCloud, syncNow, loaded } = useReminders();
  const confettiRef = useRef(null);
  const remindersRef = useRef(reminders);
  const lastCloudUserRef = useRef(null);
  const [tab, setTab] = useState("home");
  const [tabDirection, setTabDirection] = useState("forward");
  const [editing, setEditing] = useState(null);
  const [editMode, setEditMode] = useState("edit");
  const [reminding, setReminding] = useState(null);
  const [message, setMessage] = useState("");
  const [undoDelete, setUndoDelete] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const settings = { ...DEFAULT_SETTINGS, ...appSettings };
  const activeScheme = settings.themeMode;
  const isDark = typeof isDarkOverride === "boolean" ? isDarkOverride : activeScheme === "dark";
  const palette = useMemo(() => getPalette(themeColors, isDark), [themeColors, isDark]);
  const themedSurface = palette.surface;

  const firstReminder = reminders[0];
  const activeReminder = reminding || firstReminder;
  const completedCount = useMemo(() => reminders.filter((item) => item.completed).length, [reminders]);

  const handleTabChange = (nextTab) => {
    if (nextTab === tab) {
      return;
    }
    const currentIndex = TAB_ORDER.indexOf(tab);
    const nextIndex = TAB_ORDER.indexOf(nextTab);
    setTabDirection(nextIndex > currentIndex ? "forward" : "back");
    setTab(nextTab);
  };

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    return listenToAuthState(setAuthUser);
  }, []);

  useEffect(() => {
    if (!authUser || authUser.isAnonymous || authUser.uid === "offline-user" || authUser.uid === lastCloudUserRef.current) {
      return;
    }
    lastCloudUserRef.current = authUser.uid;
    refreshFromCloud(authUser.uid)
      .then(() => setMessage("Cloud reminders downloaded."))
      .catch((error) => setMessage(error.message || "Cloud download failed."));
  }, [authUser, refreshFromCloud]);

  const updateSettings = (patch) => {
    onUpdateSettings?.(patch);
  };

  const scheduleReminderAlarms = async (reminder) => {
    if (settings.reminderNotifications === false) {
      return null;
    }
    const scheduledReminder = settings.followUpNotifications === false ? { ...reminder, followUpEnabled: false, followUpCount: 0 } : reminder;
    const notificationId = await scheduleReminderNotification(scheduledReminder, settings);
    if (Platform.OS === "android" && settings.fullScreenAlerts !== false) {
      await scheduleNativeAlarm({
        ...scheduledReminder,
        notificationId,
        notificationSound: settings.notificationSound !== false,
        notificationVibration: settings.notificationVibration !== false
      }).catch(() => false);
    }
    return notificationId;
  };

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (reminding) {
        setReminding(null);
        return true;
      }
      if (editing) {
        setEditing(null);
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });

    return () => backSubscription.remove();
  }, [editing, reminding, tab]);

  useEffect(() => {
    configureNotificationChannel().catch(() => {});
    if (Platform.OS === "android") {
      // Android reminders now use the native full-screen alarm path.
      // Clear legacy Expo reminder schedules from older APKs so they do not ring in parallel.
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const reminderId = notification.request.content.data?.reminderId;
      const reminder = remindersRef.current.find((item) => item.id === reminderId);
      if (reminder) {
        setReminding(reminder);
      }
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      const reminderId = response.notification.request.content.data?.reminderId;
      const reminder = remindersRef.current.find((item) => item.id === reminderId);
      if (reminder) {
        setReminding(reminder);
      }
    });

    return () => {
      received.remove();
      responded.remove();
    };
  }, []);

  const handlePromptResponse = async (reminder, completed, mode = completed ? "yes" : "no") => {
    if (reminder.__debugPrompt && !settings.recordDebugPromptStats) {
      setReminding(null);
      setMessage("Debug prompt closed. Stats were not recorded.");
      return;
    }
    if (reminder.notificationId) {
      Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
    }
    cancelNativeAlarm(reminder.id).catch(() => {});
    const responsePatch = {
      promptYesCount: Number(reminder.promptYesCount || 0) + (mode === "yes" ? 1 : 0),
      promptNoCount: Number(reminder.promptNoCount || 0) + (mode === "no" ? 1 : 0),
      promptConfirmedCount: Number(reminder.promptConfirmedCount || 0) + (mode === "confirmed" ? 1 : 0)
    };
    const debugPrompt = Boolean(reminder.__debugPrompt);
    if (debugPrompt) {
      updateReminder(reminder.id, responsePatch);
      setReminding(null);
      setMessage("Debug prompt stats recorded.");
      return;
    }
    const bypassFollowUp = mode === "confirmed";
    const followUpReminder = bypassFollowUp || settings.followUpNotifications === false ? null : getNextFollowUpReminder(reminder);
    if (followUpReminder) {
      const notificationId = await scheduleReminderAlarms(followUpReminder);
      updateReminder(reminder.id, { ...followUpReminder, ...responsePatch, notificationId });
    } else if (reminder.repeat && isRepeatStillActive(reminder)) {
      const nextReminder = {
        ...reminder,
        scheduledAt: getNextDailyDate(reminder.scheduledAt).toISOString(),
        completed: false,
        completedAt: completed ? new Date().toISOString() : reminder.completedAt || null,
        streak: completed ? (reminder.streak || 0) + 1 : reminder.streak || 0
      };
      const notificationId = await scheduleReminderAlarms(nextReminder);
      updateReminder(reminder.id, { ...nextReminder, ...responsePatch, notificationId });
    } else if (!completed) {
      updateReminder(reminder.id, { ...responsePatch, notificationId: null });
    } else {
      updateReminder(reminder.id, {
        ...responsePatch,
        completed: true,
        completedAt: new Date().toISOString(),
        followUpCount: bypassFollowUp ? 0 : reminder.followUpCount,
        notificationId: null,
        streak: (reminder.streak || 0) + 1
      });
    }
    Haptics.notificationAsync(completed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (completed && reminder.important) {
      setCelebrating(true);
      requestAnimationFrame(() => confettiRef.current?.start());
    }
    setReminding(null);
  };

  const restoreDeletedReminder = async () => {
    if (!undoDelete) {
      return;
    }
    const reminder = { ...undoDelete };
    const notificationId = await scheduleReminderAlarms(reminder);
    addReminder({ ...reminder, notificationId });
    setUndoDelete(null);
    setMessage("Reminder restored.");
  };

  const deleteReminderWithUndo = async (reminder, afterDelete) => {
    if (reminder.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
    }
    await cancelNativeAlarm(reminder.id).catch(() => false);
    deleteReminder(reminder.id);
    setUndoDelete(reminder);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setMessage("Reminder deleted.");
    afterDelete?.();
  };

  const confirmDeleteReminder = (reminder, afterDelete) => {
    Alert.alert("Delete reminder?", "This removes the reminder and cancels its scheduled alarm.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteReminderWithUndo(reminder, afterDelete) }
    ]);
  };

  const confirmResetReminders = () => {
    Alert.alert("Reset all reminders?", "This deletes every reminder on this device and cancels scheduled alerts. This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
          await Promise.all(reminders.map((reminder) => cancelNativeAlarm(reminder.id).catch(() => false)));
          resetPrototype();
          setUndoDelete(null);
          setMessage("Reminder data reset.");
        }
      }
    ]);
  };

  const confirmResetStats = () => {
    Alert.alert("Reset stats?", "This clears Yes, No, and Really done counters for every task. Your tasks will stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset stats",
        style: "destructive",
        onPress: () => {
          resetStats();
          setMessage("Stats reset and queued for cloud sync.");
        }
      }
    ]);
  };

  const pickImage = async (source) => {
    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage(source === "camera" ? "Camera permission is needed to take a visual cue." : "Photo permission is needed to attach visual cues.");
      return null;
    }

    const launch = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72
    });

    return !result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themedSurface }, isDark && styles.safeAreaDark]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {reminding ? (
          <ReminderPrompt
            reminder={activeReminder}
            isDark={isDark}
            palette={palette}
            onNo={() => handlePromptResponse(activeReminder, false, "no")}
            onYes={() => handlePromptResponse(activeReminder, true, "yes")}
            onConfirm={() => handlePromptResponse(activeReminder, true, "confirmed")}
          />
        ) : editing ? (
          <TaskEditScreen
            reminder={editing}
            mode={editMode}
            isDark={isDark}
            palette={palette}
            onUpdate={(patch) => {
              setEditing((current) => ({ ...current, ...patch }));
            }}
            onAttachImage={async () => {
              Alert.alert("Photo visual cue", "Choose how to attach an image.", [
                { text: "Choose from phone", onPress: async () => {
                    const imageUri = await pickImage("library");
                    if (imageUri) setEditing((current) => ({ ...current, imageUri, visualType: "image" }));
                  } },
                { text: "Take photo", onPress: async () => {
                    const imageUri = await pickImage("camera");
                    if (imageUri) setEditing((current) => ({ ...current, imageUri, visualType: "image" }));
                  } },
                { text: "Cancel", style: "cancel" }
              ]);
            }}
            onSave={async () => {
              if (!editing.title.trim()) {
                setMessage("Title is required.");
                return;
              }
              if (editing.timeSet === false) {
                setMessage("Time is required.");
                return;
              }
              if (editMode === "add") {
                const reminder = {
                  ...editing,
                  id: `reminder-${Date.now()}`,
                  title: editing.title.trim(),
                  description: editing.description.trim(),
                  completed: false,
                  completedAt: null
                };
                const notificationId = await scheduleReminderAlarms(reminder);
                addReminder({ ...reminder, notificationId });
                setMessage(notificationId ? "Reminder saved and notification scheduled." : "Reminder saved.");
              } else {
                if (editing.notificationId) {
                  await Notifications.cancelScheduledNotificationAsync(editing.notificationId).catch(() => {});
                }
                await cancelNativeAlarm(editing.id).catch(() => false);
                const savedReminder = {
                  ...editing,
                  title: editing.title.trim(),
                  description: editing.description.trim(),
                  completed: false,
                  completedAt: null
                };
                const notificationId = await scheduleReminderAlarms(savedReminder);
                updateReminder(editing.id, {
                  ...savedReminder,
                  notificationId
                });
                setMessage(notificationId ? "Reminder updated and notification scheduled." : "Reminder updated. Notification permission is needed for alerts.");
              }
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={
              editMode === "edit"
                ? () => confirmDeleteReminder(editing, () => setEditing(null))
                : null
            }
          />
        ) : (
          <>
            <Animatable.View
              key={tab}
              animation={tabDirection === "forward" ? "slideInRight" : "slideInLeft"}
              duration={360}
              easing="ease-out-cubic"
              style={styles.flex}
              useNativeDriver
            >
              {tab === "home" ? (
                <HomeTab
                  reminders={reminders}
                  loaded={loaded}
                  markedDates={markedDates}
                  onTestReminder={(reminder) => setReminding({ ...reminder, __debugPrompt: true })}
                  showReminderDebugButton={settings.showReminderDebugButton}
                  isDark={isDark}
                  themeColors={themeColors}
                  palette={palette}
                  onEdit={(reminder) => {
                    setEditMode("edit");
                    setEditing({ ...reminder });
                  }}
                  onToggle={async (reminder, completed) =>
                    {
                      if (reminder.notificationId) {
                        await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
                      }
                      await cancelNativeAlarm(reminder.id).catch(() => false);
                      const notificationId = completed ? null : await scheduleReminderAlarms({ ...reminder, completed: false });
                      updateReminder(reminder.id, {
                        completed,
                        completedAt: completed ? new Date().toISOString() : null,
                        notificationId
                      });
                    }
                  }
                  onAdd={() => {
                    setEditMode("add");
                    setEditing(createDraftReminder());
                  }}
                  onDelete={(reminder) => {
                    confirmDeleteReminder(reminder);
                  }}
                />
              ) : tab === "schedule" ? (
                <ScheduleTab
                  markedDates={markedDates}
                  reminders={reminders}
                  isDark={isDark}
                  palette={palette}
                  onEdit={(reminder) => {
                    setEditMode("edit");
                    setEditing({ ...reminder });
                  }}
                />
              ) : tab === "stats" ? (
                <StatsTab reminders={reminders} isDark={isDark} palette={palette} />
              ) : tab === "account" ? (
                <AccountTab
                  reminders={reminders}
                  authUser={authUser}
                  completedCount={completedCount}
                  isDark={isDark}
                  palette={palette}
                  onSyncNow={syncNow}
                  onMessage={setMessage}
                />
              ) : (
                <SettingsTab
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  isDark={isDark}
                  palette={palette}
                  onReset={confirmResetReminders}
                  onResetStats={confirmResetStats}
                  onMessage={setMessage}
                />
              )}
            </Animatable.View>
            <BottomNav active={tab} isDark={isDark} palette={palette} taskCount={reminders.length} onChange={handleTabChange} />
          </>
        )}
      </KeyboardAvoidingView>

      {celebrating ? (
        <ConfettiCannon
          ref={confettiRef}
          count={80}
          origin={{ x: 180, y: 0 }}
          autoStart={false}
          fadeOut
          onAnimationEnd={() => setCelebrating(false)}
        />
      ) : null}
      <Snackbar
        visible={Boolean(message)}
        onDismiss={() => {
          setMessage("");
          setUndoDelete(null);
        }}
        duration={4200}
        action={undoDelete ? { label: "Undo", onPress: restoreDeletedReminder } : undefined}
      >
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

function ScreenTitle({ children, action, isDark = false }) {
  return (
    <View style={styles.titleWrap}>
      <Text style={[styles.screenTitle, isDark && styles.textOnDark]}>{children}</Text>
      {action ? <View style={styles.titleAction}>{action}</View> : null}
    </View>
  );
}

function HomeTab({ reminders, loaded, markedDates, onTestReminder, showReminderDebugButton, isDark, themeColors = {}, palette, onEdit, onToggle, onAdd, onDelete }) {
  const [query, setQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const colors = palette || getPalette(themeColors, isDark);
  const primary = colors.primary;
  const visibleReminders = reminders.filter((reminder) => {
    const haystack = `${reminder.title} ${reminder.description || ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Tasks</ScreenTitle>
      <ScrollView style={styles.flex} contentContainerStyle={styles.homeList}>
        {!loaded ? (
          <View style={styles.emptyHome}>
            <View style={[styles.emptyVisual, { backgroundColor: colors.primaryContainer }]}>
              <MaterialCommunityIcons name="database-clock-outline" size={42} color={primary} />
            </View>
            <Text style={[styles.emptyTitle, isDark && styles.textOnDark]}>Loading reminders</Text>
            <Text style={[styles.emptyText, isDark && styles.mutedOnDark]}>Restoring local data first.</Text>
          </View>
        ) : !visibleReminders.length ? (
          <View style={styles.emptyHome}>
            <View style={[styles.emptyVisual, { backgroundColor: colors.primaryContainer }]}>
              <MaterialCommunityIcons name="bell-plus-outline" size={42} color={primary} />
            </View>
            <Text style={[styles.emptyTitle, isDark && styles.textOnDark]}>No reminders yet</Text>
            <Text style={[styles.emptyText, styles.emptyTextCentered, isDark && styles.mutedOnDark]}>Use the add button below to create your first visual reminder.</Text>
          </View>
        ) : null}
        {visibleReminders.map((reminder, index) => (
          <Animatable.View key={reminder.id} animation="slideInUp" delay={index * 45} duration={420} useNativeDriver>
            {/* react-native-gesture-handler gives this list a native-feeling swipe delete gesture. */}
            <Swipeable
              overshootRight={false}
              renderRightActions={() => (
                <SwipeDeleteAction
                  onPress={() => onDelete(reminder)}
                />
              )}
            >
            <Pressable style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]} onPress={() => onEdit(reminder)}>
              <View style={styles.visualBubble}>
                <VisualCue reminder={reminder} size={44} iconSize={22} compact palette={colors} />
              </View>
              <View style={styles.taskCopy}>
                <Text style={[styles.taskTime, { color: primary }]}>
                  {format(parseISO(reminder.scheduledAt), "h:mm a")} - {getCountdownLabel(reminder.scheduledAt)}
                </Text>
                <Text style={[styles.taskTitle, isDark && styles.textOnDark]}>{reminder.title}</Text>
                {reminder.description ? <Text style={[styles.taskDescription, isDark && styles.mutedOnDark]}>{reminder.description}</Text> : null}
              </View>
              <View style={styles.taskActions}>
              {showReminderDebugButton ? (
                <Pressable style={styles.testButton} onPress={() => onTestReminder(reminder)}>
                  <MaterialCommunityIcons name="play-circle-outline" size={22} color={primary} />
                </Pressable>
              ) : null}
                <Switch value={!reminder.completed} color={primary} onValueChange={(value) => onToggle(reminder, !value)} />
              </View>
            </Pressable>
            </Swipeable>
          </Animatable.View>
        ))}

      </ScrollView>
      <Animatable.View
        animation={keyboardHeight ? "slideInUp" : undefined}
        duration={220}
        style={[
          styles.searchDock,
          { backgroundColor: colors.surfaceVariant, bottom: keyboardHeight ? keyboardHeight + 20 : 96 },
          isDark && styles.surfaceVariantOnDark
        ]}
      >
        <MaterialCommunityIcons name="magnify" size={22} color={colors.onSurfaceVariant} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          mode="flat"
          dense
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          style={styles.searchDockInput}
          textColor={colors.onSurface}
          placeholderTextColor={colors.onSurfaceVariant}
          theme={{ colors: { primary, onSurfaceVariant: colors.onSurfaceVariant } }}
        />
        <Pressable style={[styles.addButton, { backgroundColor: primary }]} onPress={onAdd}>
          <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
        </Pressable>
      </Animatable.View>
    </View>
  );
}

function ScheduleTab({ markedDates, reminders, isDark, palette, onEdit }) {
  const colors = palette || getPalette({}, isDark);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [visibleMonth, setVisibleMonth] = useState(format(new Date(), "yyyy-MM"));
  const selectedReminders = reminders.filter((reminder) => shouldShowReminderOnDate(reminder, selectedDate));
  const scheduleMarkedDates = buildScheduleMarkedDates(reminders, visibleMonth, colors.primary);
  const selectedMarkedDates = {
    ...markedDates,
    ...scheduleMarkedDates,
    [selectedDate]: {
      ...(markedDates[selectedDate] || scheduleMarkedDates[selectedDate] || {}),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.onPrimary
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Schedule</ScreenTitle>
      <ScrollView contentContainerStyle={styles.scheduleContent}>
        <Animatable.View animation="slideInUp" duration={440} delay={60} useNativeDriver>
        <View style={[styles.materialCard, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Month task distribution</Text>
          <Calendar
            markedDates={selectedMarkedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={(month) => setVisibleMonth(`${month.year}-${String(month.month).padStart(2, "0")}`)}
            theme={{
              calendarBackground: colors.surface,
              backgroundColor: colors.surface,
              dayTextColor: colors.onSurface,
              monthTextColor: colors.onSurface,
              textSectionTitleColor: colors.onSurfaceVariant,
              selectedDayBackgroundColor: colors.primary,
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              textDayFontSize: 12,
              textMonthFontSize: 14,
              textDayHeaderFontSize: 11
            }}
          />
        </View>
        </Animatable.View>
        <Animatable.View animation="slideInUp" duration={440} delay={150} useNativeDriver>
        <View style={[styles.materialCard, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>{format(parseISO(selectedDate), DATE_DISPLAY_FORMAT)} reminders</Text>
          {selectedReminders.length ? (
            selectedReminders.map((reminder) => (
              <Pressable key={reminder.id} style={styles.scheduleRow} onPress={() => onEdit(reminder)}>
                <VisualCue reminder={reminder} size={44} iconSize={22} compact palette={colors} />
                <View style={styles.scheduleCopy}>
                  <Text style={[styles.taskTitle, isDark && styles.textOnDark]}>{reminder.title}</Text>
                  <Text style={[styles.taskTime, { color: colors.primary }]}>
                    {format(parseISO(reminder.scheduledAt), "h:mm a")} - {getCountdownLabel(reminder.scheduledAt)}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            ))
          ) : (
            <View style={styles.emptySchedule}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={colors.onSurfaceVariant} />
              <Text style={[styles.emptyText, isDark && styles.mutedOnDark]}>No reminders on this date.</Text>
            </View>
          )}
        </View>
        </Animatable.View>
      </ScrollView>
    </View>
  );
}

function StatsTab({ reminders, isDark, palette }) {
  const colors = palette || getPalette({}, isDark);
  const totals = reminders.reduce(
    (acc, reminder) => {
      acc.yes += Number(reminder.promptYesCount || 0);
      acc.no += Number(reminder.promptNoCount || 0);
      acc.confirmed += Number(reminder.promptConfirmedCount || 0);
      return acc;
    },
    { yes: 0, no: 0, confirmed: 0 }
  );
  const totalResponses = totals.yes + totals.no + totals.confirmed;
  const riskRows = reminders
    .map((reminder) => {
      const yes = Number(reminder.promptYesCount || 0);
      const no = Number(reminder.promptNoCount || 0);
      const confirmed = Number(reminder.promptConfirmedCount || 0);
      return {
        reminder,
        score: no + Math.max(0, yes - confirmed),
        yes,
        no,
        confirmed
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const cards = [
    ["Really done", totals.confirmed, "brain", colors.primary],
    ["Yes taps", totals.yes, "check-circle-outline", SUCCESS],
    ["No taps", totals.no, "close-circle-outline", ERROR]
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Stats</ScreenTitle>
      <ScrollView contentContainerStyle={styles.statsContent}>
        <Animatable.View animation="slideInUp" duration={460} delay={60} useNativeDriver>
          <View style={[styles.statsHero, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
            <Text style={[styles.statsHeroLabel, { color: colors.primary }]}>Reminder memory signal</Text>
            <StatPieChart
              totals={totals}
              colors={{
                confirmed: colors.primary,
                yes: SUCCESS,
                no: ERROR,
                track: colors.surfaceVariant,
                text: colors.onSurface
              }}
            />
            <Text style={[styles.statsHeroCopy, isDark && styles.mutedOnDark]}>
              Total recorded reminder responses.
            </Text>
            <View style={styles.pieLegend}>
              <LegendDot color={colors.primary} label="Really done" isDark={isDark} />
              <LegendDot color={SUCCESS} label="Yes taps" isDark={isDark} />
              <LegendDot color={ERROR} label="No taps" isDark={isDark} />
            </View>
          </View>
        </Animatable.View>

        <View style={styles.statsCardGrid}>
          {cards.map(([label, value, icon, color], index) => (
            <Animatable.View key={label} animation="slideInUp" delay={140 + index * 70} duration={420} style={[styles.statsMiniCard, { backgroundColor: colors.surface, borderColor: colors.outline }]} useNativeDriver>
              <MaterialCommunityIcons name={icon} size={24} color={color} />
              <Text style={[styles.statsMiniValue, { color }]}>{value}</Text>
              <Text style={[styles.statsMiniLabel, isDark && styles.mutedOnDark]}>{label}</Text>
            </Animatable.View>
          ))}
        </View>

        <Animatable.View animation="slideInUp" duration={440} delay={260} useNativeDriver>
        <View style={[styles.materialCard, styles.statsInsightCard, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
          <Text style={[styles.sectionTitle, styles.statsInsightTitle, isDark && styles.textOnDark]}>Likely forgettable tasks</Text>
          <Text style={[styles.statsInsightCopy, isDark && styles.mutedOnDark]}>
            Tasks with more No taps or unconfirmed Yes taps appear here first.
          </Text>
          {riskRows.length ? (
            riskRows.map(({ reminder, score, yes, no, confirmed }) => (
              <View key={reminder.id} style={styles.riskRow}>
                <VisualCue reminder={reminder} size={38} iconSize={18} compact palette={colors} />
                <View style={styles.riskCopy}>
                  <Text style={[styles.taskTitle, isDark && styles.textOnDark]} numberOfLines={1}>{reminder.title}</Text>
                  <Text style={[styles.taskDescription, isDark && styles.mutedOnDark]}>
                    Risk {score} · Yes {yes} · No {no} · Really done {confirmed}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, styles.emptyTextCentered, isDark && styles.mutedOnDark]}>
              No reminder response data yet. Use the reminder screen to start building stats.
            </Text>
          )}
        </View>
        </Animatable.View>
      </ScrollView>
    </View>
  );
}

function LegendDot({ color, label, isDark }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, isDark && styles.mutedOnDark]}>{label}</Text>
    </View>
  );
}

function StatPieChart({ totals, colors }) {
  const size = 156;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = totals.confirmed + totals.yes + totals.no;
  const segments = [
    { key: "confirmed", value: totals.confirmed, color: colors.confirmed },
    { key: "yes", value: totals.yes, color: colors.yes },
    { key: "no", value: totals.no, color: colors.no }
  ].filter((segment) => segment.value > 0);
  let offset = 0;

  return (
    <View style={styles.pieWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.track}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {segments.map((segment) => {
          const dash = total ? (segment.value / total) * circumference : 0;
          const circle = (
            <Circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              fill="transparent"
              origin={`${size / 2}, ${size / 2}`}
              rotation="-90"
            />
          );
          offset += dash;
          return circle;
        })}
      </Svg>
      <View style={styles.pieCenter}>
        <Text style={[styles.pieCenterValue, { color: colors.text }]}>{total}</Text>
        <Text style={styles.pieCenterLabel}>total</Text>
      </View>
    </View>
  );
}

function SwipeDeleteAction({ onPress }) {
  return (
    <Pressable style={styles.swipeDeleteAction} onPress={onPress}>
      <MaterialCommunityIcons name="delete-outline" size={24} color="#FFFFFF" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </Pressable>
  );
}

function ReminderPrompt({ reminder, isDark, palette, onNo, onYes, onConfirm }) {
  const colors = palette || getPalette({}, isDark);
  return (
    <Animatable.View animation="zoomInUp" duration={420} style={[styles.reminderScreen, { backgroundColor: colors.background }, isDark && styles.screenDark]} useNativeDriver>
      <ScreenTitle isDark={isDark}>VizMinder</ScreenTitle>
      <Animatable.View animation="pulse" iterationCount="infinite" duration={1800} useNativeDriver>
        <VisualCue reminder={reminder} size={104} iconSize={48} palette={colors} />
      </Animatable.View>
      <View style={styles.reminderCopy}>
        <Text style={[styles.reminderHeadline, { color: colors.primary }]}>It is {format(parseISO(reminder.scheduledAt), "hh:mm")} now !</Text>
        <Text style={[styles.reminderQuestion, { color: colors.primary }]}>Have you completed {reminder.title}?</Text>
        <Pressable
          style={[styles.confirmMemoryButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={onConfirm}
          accessibilityLabel="Confirm this reminder is fully done"
        >
          <MaterialCommunityIcons name="brain" size={18} color={colors.primary} />
          <Text style={[styles.confirmMemoryText, { color: colors.primary }]}>I really did it</Text>
        </Pressable>
      </View>
      <View style={styles.answerRow}>
        <Pressable style={[styles.answerButton, { backgroundColor: colors.primary }]} onPress={onNo}>
          <MaterialCommunityIcons name="close" size={38} color="#FFFFFF" />
        </Pressable>
        <Pressable style={[styles.answerButton, { backgroundColor: colors.primaryContainer }]} onPress={onYes}>
          <MaterialCommunityIcons name="check" size={38} color="#FFFFFF" />
        </Pressable>
      </View>
    </Animatable.View>
  );
}

function TaskEditScreen({ reminder, mode, isDark, palette, onUpdate, onAttachImage, onSave, onCancel, onDelete }) {
  const colors = palette || getPalette({}, isDark);
  const [timeOpen, setTimeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [repeatUntilOpen, setRepeatUntilOpen] = useState(false);
  const currentScheduled = isValid(parseISO(reminder.scheduledAt)) ? parseISO(reminder.scheduledAt) : new Date();
  const timePickerValue = reminder.timeSet === false ? new Date() : currentScheduled;
  const datePickerValue = reminder.hasDate === false ? new Date() : currentScheduled;
  const repeatUntilValue = reminder.repeatUntil && isValid(parseISO(reminder.repeatUntil)) ? parseISO(reminder.repeatUntil) : currentScheduled;
  const openTimePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: timePickerValue,
        mode: "time",
        display: "default",
        is24Hour: true,
        positiveButton: { label: "OK", textColor: colors.primary },
        negativeButton: { label: "Cancel", textColor: colors.onSurfaceVariant },
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            const nextDate = set(currentScheduled, {
              hours: selectedDate.getHours(),
              minutes: selectedDate.getMinutes(),
              seconds: 0,
              milliseconds: 0
            });
            onUpdate({ scheduledAt: nextDate.toISOString(), timeSet: true });
          }
        }
      });
      return;
    }
    setTimeOpen(true);
  };
  const openDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: datePickerValue,
        mode: "date",
        display: "default",
        positiveButton: { label: "OK", textColor: colors.primary },
        negativeButton: { label: "Cancel", textColor: colors.onSurfaceVariant },
        neutralButton: { label: "Clear", textColor: colors.onSurfaceVariant },
        onChange: (event, selectedDate) => {
          if (event.type === "neutralButtonPressed") {
            onUpdate({ hasDate: false });
            return;
          }
          if (event.type === "set" && selectedDate) {
            const nextDate = set(selectedDate, {
              hours: currentScheduled.getHours(),
              minutes: currentScheduled.getMinutes(),
              seconds: 0,
              milliseconds: 0
            });
            onUpdate({ scheduledAt: nextDate.toISOString(), hasDate: true });
          }
        }
      });
      return;
    }
    setDateOpen(true);
  };
  const openRingtonePicker = () => {
    Alert.alert(
      "Reminder sound",
      "Choose the sound used by the full-screen alarm.",
      RINGTONE_OPTIONS.map(([value, label]) => ({
        text: label,
        onPress: () => onUpdate({ ringtone: value })
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };
  const openRepeatUntilPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: repeatUntilValue,
        mode: "date",
        display: "default",
        positiveButton: { label: "OK", textColor: colors.primary },
        negativeButton: { label: "Cancel", textColor: colors.onSurfaceVariant },
        neutralButton: { label: "Clear", textColor: colors.onSurfaceVariant },
        onChange: (event, selectedDate) => {
          if (event.type === "neutralButtonPressed") {
            onUpdate({ repeatUntil: null });
            return;
          }
          if (event.type === "set" && selectedDate) {
            const endOfDay = set(selectedDate, { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });
            onUpdate({ repeatUntil: endOfDay.toISOString() });
          }
        }
      });
      return;
    }
    setRepeatUntilOpen(true);
  };
  const openFollowUpCountPicker = () => {
    Alert.alert(
      "Follow-up reminders",
      "How many extra reminders should fire after the first alert?",
      FOLLOW_UP_COUNTS.map((count) => ({
        text: count === 0 ? "Off" : `${count} time${count > 1 ? "s" : ""}`,
        onPress: () => onUpdate({ followUpEnabled: count > 0, followUpCount: count })
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };
  const openFollowUpIntervalPicker = () => {
    Alert.alert(
      "Follow-up interval",
      "How long should VizMinder wait between follow-up reminders?",
      FOLLOW_UP_INTERVALS.map((minutes) => ({
        text: `${minutes} minute${minutes > 1 ? "s" : ""}`,
        onPress: () => onUpdate({ followUpIntervalMinutes: minutes })
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };
  const ringtoneLabel = RINGTONE_OPTIONS.find(([value]) => value === reminder.ringtone)?.[1] || "System alarm";
  return (
    <Animatable.View animation="fadeInUp" duration={240} style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]} useNativeDriver>
      <ScreenTitle isDark={isDark}>{mode === "add" ? "Add Task" : "Edit Task"}</ScreenTitle>
      <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
        <View style={styles.imageEditWrap}>
          <VisualCue reminder={reminder} size={104} iconSize={48} palette={colors} />
          <Pressable style={[styles.editFab, { backgroundColor: colors.primary }]} onPress={onAttachImage}>
            <MaterialCommunityIcons name="pencil" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <VisualSourcePicker reminder={reminder} isDark={isDark} palette={colors} onUpdate={onUpdate} onAttachImage={onAttachImage} />

        <EditTextField isDark={isDark} palette={colors} label="Title" value={reminder.title} onChangeText={(title) => onUpdate({ title })} />
        <EditTextField
          isDark={isDark}
          palette={colors}
          label="Description (optional)"
          value={reminder.description}
          onChangeText={(description) => onUpdate({ description })}
          multiline
        />
        <EditField
          isDark={isDark}
          palette={colors}
          label="Time"
          value={reminder.timeSet === false ? "Required" : format(parseISO(reminder.scheduledAt), "HH:mm")}
          onPress={openTimePicker}
          onClear={() => onUpdate({ timeSet: false })}
        />
        <EditField
          isDark={isDark}
          palette={colors}
          label="Date"
          value={reminder.hasDate === false ? "Optional" : format(parseISO(reminder.scheduledAt), DATE_DISPLAY_FORMAT)}
          onPress={openDatePicker}
          onClear={() => onUpdate({ hasDate: false })}
        />
        <EditField
          isDark={isDark}
          palette={colors}
          label="Sound"
          value={ringtoneLabel}
          onPress={openRingtonePicker}
        />
        <View style={[styles.importantRow, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]}>
          <View style={styles.settingsCopy}>
            <Text style={[styles.editLabel, isDark && styles.textOnDark]}>Repeat daily</Text>
            <Text style={[styles.importantHelp, isDark && styles.mutedOnDark]}>Remind again every day at this time.</Text>
          </View>
          <Switch value={Boolean(reminder.repeat)} color={colors.primary} onValueChange={(repeat) => onUpdate({ repeat })} />
        </View>
        {reminder.repeat ? (
          <EditField
            isDark={isDark}
            palette={colors}
            label="Repeat until"
            value={reminder.repeatUntil ? format(parseISO(reminder.repeatUntil), DATE_DISPLAY_FORMAT) : "No end date"}
            onPress={openRepeatUntilPicker}
            onClear={() => onUpdate({ repeatUntil: null })}
          />
        ) : null}
        <View style={[styles.importantRow, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]}>
          <View style={styles.settingsCopy}>
            <Text style={[styles.editLabel, isDark && styles.textOnDark]}>After-answer follow-up</Text>
            <Text style={[styles.importantHelp, isDark && styles.mutedOnDark]}>Repeat after Yes or No for time-sensitive tasks.</Text>
          </View>
          <Switch
            value={Boolean(reminder.followUpEnabled)}
            color={colors.primary}
            onValueChange={(followUpEnabled) => onUpdate({ followUpEnabled, followUpCount: followUpEnabled ? reminder.followUpCount || 3 : 0 })}
          />
        </View>
        {reminder.followUpEnabled ? (
          <>
            <EditNumberField
              isDark={isDark}
              palette={colors}
              label="Follow-up count"
              value={String(reminder.followUpCount || 1)}
              helper="Extra alerts after Yes or No"
              min={1}
              max={20}
              onChangeNumber={(followUpCount) => onUpdate({ followUpCount, followUpEnabled: followUpCount > 0 })}
              onQuickPick={openFollowUpCountPicker}
            />
            <EditNumberField
              isDark={isDark}
              palette={colors}
              label="Follow-up interval"
              suffix="min"
              value={String(reminder.followUpIntervalMinutes || 5)}
              helper="Minutes between follow-up alerts"
              min={1}
              max={240}
              onChangeNumber={(followUpIntervalMinutes) => onUpdate({ followUpIntervalMinutes })}
              onQuickPick={openFollowUpIntervalPicker}
            />
          </>
        ) : null}
        <View style={[styles.importantRow, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]}>
          <View>
            <Text style={[styles.editLabel, isDark && styles.textOnDark]}>Important reminder</Text>
            <Text style={[styles.importantHelp, isDark && styles.mutedOnDark]}>Yes triggers celebration when completed.</Text>
          </View>
          <Switch value={Boolean(reminder.important)} color={colors.primary} onValueChange={(important) => onUpdate({ important })} />
        </View>

        <View style={styles.formActions}>
          {onDelete ? (
            <Button mode="text" icon="delete-outline" textColor={ERROR} style={styles.deleteButton} onPress={onDelete}>
              Delete
            </Button>
          ) : null}
          <Button mode="contained" buttonColor={colors.primary} textColor={colors.onPrimary} style={styles.actionButton} onPress={onSave}>
            Save
          </Button>
          <Button mode="outlined" textColor={colors.onSurfaceVariant} style={styles.actionButton} onPress={onCancel}>
            Cancel
          </Button>
        </View>
      </ScrollView>

      {timeOpen ? (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          display={Platform.OS === "android" ? "clock" : "default"}
          design={Platform.OS === "android" ? "material" : undefined}
          initialInputMode="default"
          is24Hour
          positiveButton={{ label: "OK", textColor: colors.primary }}
          negativeButton={{ label: "Cancel", textColor: colors.onSurfaceVariant }}
          onChange={(event, selectedDate) => {
            setTimeOpen(Platform.OS === "ios");
            if (event.type === "set" && selectedDate) {
              const nextDate = set(currentScheduled, {
                hours: selectedDate.getHours(),
                minutes: selectedDate.getMinutes(),
                seconds: 0,
                milliseconds: 0
              });
              onUpdate({ scheduledAt: nextDate.toISOString(), timeSet: true });
            }
          }}
        />
      ) : null}
      {dateOpen ? (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          design={Platform.OS === "android" ? "material" : undefined}
          initialInputMode="default"
          positiveButton={{ label: "OK", textColor: colors.primary }}
          negativeButton={{ label: "Cancel", textColor: colors.onSurfaceVariant }}
          neutralButton={{ label: "Clear", textColor: colors.onSurfaceVariant }}
          onChange={(event, selectedDate) => {
            setDateOpen(Platform.OS === "ios");
            if (event.type === "neutralButtonPressed") {
              onUpdate({ hasDate: false });
              return;
            }
            if (event.type === "set" && selectedDate) {
              const nextDate = set(selectedDate, {
                hours: currentScheduled.getHours(),
                minutes: currentScheduled.getMinutes(),
                seconds: 0,
                milliseconds: 0
              });
              onUpdate({ scheduledAt: nextDate.toISOString(), hasDate: true });
            }
          }}
        />
      ) : null}
      {repeatUntilOpen ? (
        <DateTimePicker
          value={repeatUntilValue}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          design={Platform.OS === "android" ? "material" : undefined}
          positiveButton={{ label: "OK", textColor: colors.primary }}
          negativeButton={{ label: "Cancel", textColor: colors.onSurfaceVariant }}
          neutralButton={{ label: "Clear", textColor: colors.onSurfaceVariant }}
          onChange={(event, selectedDate) => {
            setRepeatUntilOpen(Platform.OS === "ios");
            if (event.type === "neutralButtonPressed") {
              onUpdate({ repeatUntil: null });
              return;
            }
            if (event.type === "set" && selectedDate) {
              const endOfDay = set(selectedDate, { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });
              onUpdate({ repeatUntil: endOfDay.toISOString() });
            }
          }}
        />
      ) : null}
    </Animatable.View>
  );
}

function EditField({ label, value, isDark = false, palette, onPress, onClear }) {
  const colors = palette || getPalette({}, isDark);
  return (
    <Pressable style={[styles.editField, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]} onPress={onPress}>
      <Text style={[styles.editLabel, isDark && styles.textOnDark]}>{label}</Text>
      <View style={[styles.editValue, { backgroundColor: colors.surfaceVariant }, isDark && styles.inputOnDark]}>
        <Text style={[styles.editValueText, { color: colors.onSurfaceVariant }]}>{value}</Text>
        {onClear ? (
          <Pressable
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
        )}
      </View>
    </Pressable>
  );
}

function EditNumberField({ label, value, suffix = "", helper, min, max, isDark = false, palette, onChangeNumber, onQuickPick }) {
  const colors = palette || getPalette({}, isDark);
  return (
    <View style={[styles.editTextField, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]}>
      <View style={styles.numberFieldHeader}>
        <View style={styles.settingsCopy}>
          <Text style={[styles.editLabel, isDark && styles.textOnDark]}>{label}</Text>
          {helper ? <Text style={[styles.importantHelp, isDark && styles.mutedOnDark]}>{helper}</Text> : null}
        </View>
        {onQuickPick ? (
          <Pressable style={[styles.dialogIconButton, { backgroundColor: colors.surfaceVariant }]} onPress={onQuickPick}>
            <MaterialCommunityIcons name="menu-down" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.numberInputRow, { backgroundColor: colors.surfaceVariant }, isDark && styles.inputOnDark]}>
        <TextInput
          value={value}
          onChangeText={(text) => {
            const numeric = Number(text.replace(/[^\d]/g, ""));
            if (!Number.isFinite(numeric)) {
              return;
            }
            onChangeNumber(clampNumber(numeric, min, max));
          }}
          keyboardType="number-pad"
          mode="flat"
          dense
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          style={styles.numberInput}
          textColor={colors.onSurface}
          theme={{ colors: { primary: colors.primary } }}
        />
        {suffix ? <Text style={[styles.editValueText, { color: colors.onSurfaceVariant }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function EditTextField({ label, value, isDark = false, palette, onChangeText, multiline = false }) {
  const colors = palette || getPalette({}, isDark);
  return (
    <View style={[styles.editTextField, { backgroundColor: colors.surface, borderColor: colors.outline }, multiline && styles.editTextFieldTall, isDark && styles.cardOnDark]}>
      <Text style={[styles.editLabel, isDark && styles.textOnDark]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        mode="flat"
        dense
        multiline={multiline}
        placeholder={label.startsWith("Description") ? "Optional" : "Required"}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        style={[styles.editTextInput, { backgroundColor: colors.surfaceVariant }, multiline && styles.editTextInputTall]}
        textColor={colors.onSurface}
        placeholderTextColor={colors.onSurfaceVariant}
        theme={{ colors: { primary: colors.primary, onSurfaceVariant: colors.onSurfaceVariant } }}
      />
    </View>
  );
}

function AccountTab({ reminders, authUser, completedCount, isDark, palette, onSyncNow, onMessage }) {
  const colors = palette || getPalette({}, isDark);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [syncRows, setSyncRows] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncError, setSyncError] = useState("");

  const signedIn = authUser && !authUser.isAnonymous && authUser.uid !== "offline-user";
  const accountLabel = signedIn ? authUser.email || "Email account" : authUser?.isAnonymous ? "Anonymous session" : "Not signed in";

  const submitEmailAuth = async (mode) => {
    setSyncError("");
    try {
      if (mode === "register") {
        await registerWithEmail(email, password);
        onMessage("Account created.");
      } else {
        await loginWithEmail(email, password);
        onMessage("Signed in.");
      }
      setPassword("");
    } catch (error) {
      setSyncError(error.message);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncError("");
    setSyncProgress(0.15);
    try {
      const services = getFirebaseServices();
      const userId = services?.auth?.currentUser?.uid;
      if (!services || !userId || userId === "offline-user") {
        throw new Error("Sign in with Firebase before syncing.");
      }
      setSyncProgress(0.35);
      const merged = await onSyncNow(userId);
      setSyncProgress(0.7);
      const cloud = await fetchRemindersFromFirestore(userId);
      const cloudIds = new Set(cloud.map((item) => item.id));
      setSyncRows(
        merged.map((reminder) => ({
          id: reminder.id,
          title: reminder.title || "Untitled reminder",
          status: cloudIds.has(reminder.id) ? "Synced" : "Not synced"
        }))
      );
      setSyncProgress(1);
      onMessage("Sync complete.");
    } catch (error) {
      setSyncError(error.message || "Sync failed.");
      setSyncProgress(0);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Account</ScreenTitle>
      <Animatable.View animation="slideInUp" duration={430} delay={60} useNativeDriver>
      <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
          <MaterialCommunityIcons name="account-outline" size={36} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.accountName, isDark && styles.textOnDark]}>User</Text>
          <Text style={[styles.accountPlan, isDark && styles.textOnDark]}>{accountLabel}</Text>
        </View>
      </View>
      </Animatable.View>
      <ScrollView contentContainerStyle={styles.accountContent}>
        {!signedIn ? (
          <Animatable.View animation="slideInUp" duration={430} delay={140} style={[styles.planBlock, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]} useNativeDriver>
            <Text style={[styles.planTitle, isDark && styles.textOnDark]}>Sign in</Text>
            <TextInput value={email} onChangeText={setEmail} label="Email" autoCapitalize="none" keyboardType="email-address" style={[styles.authInput, { backgroundColor: colors.surfaceVariant }]} textColor={colors.onSurface} />
            <TextInput value={password} onChangeText={setPassword} label="Password" secureTextEntry style={[styles.authInput, { backgroundColor: colors.surfaceVariant }]} textColor={colors.onSurface} />
            <Text style={[styles.planCopy, isDark && styles.mutedOnDark]}>Password requires at least 8 characters, 2 letters, and 6 numbers.</Text>
            {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
            <View style={styles.planActions}>
              <Button mode="outlined" textColor={colors.primary} style={styles.planButton} onPress={() => submitEmailAuth("login")}>Login</Button>
              <Button mode="contained" buttonColor={colors.primary} style={styles.planButton} onPress={() => submitEmailAuth("register")}>Register</Button>
            </View>
          </Animatable.View>
        ) : (
          <Animatable.View animation="slideInUp" duration={430} delay={140} style={[styles.planBlock, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]} useNativeDriver>
            <Text style={[styles.planTitle, isDark && styles.textOnDark]}>Signed in</Text>
            <Text style={[styles.planCopy, isDark && styles.mutedOnDark]}>{accountLabel}</Text>
            {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
            <Button mode="outlined" textColor={colors.primary} onPress={() => signOutUser().catch((error) => setSyncError(error.message))}>Sign out</Button>
          </Animatable.View>
        )}

        {signedIn ? (
        <Animatable.View animation="slideInUp" duration={430} delay={220} style={[styles.planBlock, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]} useNativeDriver>
          <Text style={[styles.planTitle, isDark && styles.textOnDark]}>Sync Data</Text>
          <Text style={[styles.planCopy, isDark && styles.mutedOnDark]}>Completed reminders: {completedCount}</Text>
          <Text style={[styles.planCopy, isDark && styles.mutedOnDark]}>Sync status: {syncing ? "Syncing" : syncProgress === 1 ? "Synced" : "Idle"}</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(syncProgress * 100)}%` }]} />
          </View>
          <Button mode="contained" buttonColor={colors.primary} loading={syncing} disabled={syncing} onPress={runSync}>Sync now</Button>
          <View style={styles.syncList}>
            {syncRows.length ? syncRows.map((row) => (
              <View key={row.id} style={styles.syncRow}>
                <Text style={[styles.packageText, isDark && styles.mutedOnDark]}>{row.title}</Text>
                <Text style={[styles.syncStatus, row.status === "Synced" ? styles.syncOk : styles.syncWarn]}>{row.status}</Text>
              </View>
            )) : <Text style={[styles.packageText, isDark && styles.mutedOnDark]}>Press sync to inspect current Firestore status.</Text>}
          </View>
        </Animatable.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SettingsTab({ settings, onUpdateSettings, isDark, palette, onReset, onResetStats, onMessage }) {
  const colors = palette || getPalette({}, isDark);
  const [settingsPage, setSettingsPage] = useState("main");
  const [settingsDirection, setSettingsDirection] = useState("forward");
  const openSettingsPage = (page) => {
    setSettingsDirection("forward");
    setSettingsPage(page);
  };
  const goSettingsMain = () => {
    setSettingsDirection("back");
    setSettingsPage("main");
  };
  useEffect(() => {
    if (Platform.OS !== "android" || settingsPage === "main") {
      return undefined;
    }
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goSettingsMain();
      return true;
    });
    return () => backSubscription.remove();
  }, [settingsPage]);
  const items = [
    ["palette-outline", "Theme", "Light, dark, and Material color options.", () => openSettingsPage("theme")],
    ["tune-vertical", "Advanced", "Debug controls and native alarm notes.", () => openSettingsPage("advanced")],
    ["message-outline", "Notification", "Notification permissions, alert sound, and system settings.", () => openSettingsPage("notification")],
    ["restart", "Reset", "Clear task data or reset stats separately.", () => openSettingsPage("reset")]
  ];

  if (settingsPage === "theme") {
    return (
      <SettingsPageMotion page={settingsPage} direction={settingsDirection} colors={colors} isDark={isDark}>
        <ScreenTitle isDark={isDark}>Theme</ScreenTitle>
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Pressable style={styles.backRow} onPress={goSettingsMain}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Theme mode</Text>
            <View style={styles.segmentedControl}>
              {[
                ["light", "Light"],
                ["dark", "Dark"]
              ].map(([mode, label]) => (
                <Pressable
                  key={mode}
                  style={[styles.segmentButton, { borderColor: colors.outline }, settings.themeMode === mode && { backgroundColor: colors.primary }]}
                  onPress={() => onUpdateSettings({ themeMode: mode })}
                >
                  <Text style={[styles.segmentText, isDark && styles.mutedOnDark, settings.themeMode === mode && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsCopy}>
                <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Follow system Material colors</Text>
                <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                  {settings.followSystemColors ? "Use system color preference when available." : "Use VizMinder purple palette."}
                </Text>
              </View>
              <Switch value={settings.followSystemColors} color={colors.primary} onValueChange={(value) => onUpdateSettings({ followSystemColors: value })} />
            </View>
          </View>
        </ScrollView>
      </SettingsPageMotion>
    );
  }

  if (settingsPage === "advanced") {
    return (
      <SettingsPageMotion page={settingsPage} direction={settingsDirection} colors={colors} isDark={isDark}>
        <ScreenTitle isDark={isDark}>Advanced</ScreenTitle>
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Pressable style={styles.backRow} onPress={goSettingsMain}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsCopy}>
                <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Reminder debug button</Text>
                <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>Show the Home test button for the Yes/No prompt.</Text>
              </View>
              <Switch
                value={settings.showReminderDebugButton}
                color={colors.primary}
                onValueChange={(value) => onUpdateSettings({ showReminderDebugButton: value })}
              />
            </View>
            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsCopy}>
                <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Record debug prompt stats</Text>
                <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                  When off, pressing the Home debug prompt does not change Stats.
                </Text>
              </View>
              <Switch
                value={settings.recordDebugPromptStats}
                color={colors.primary}
                onValueChange={(value) => onUpdateSettings({ recordDebugPromptStats: value })}
              />
            </View>
            <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
              The installed Android APK uses native AlarmManager and a lock-screen Activity for full-screen visual reminders. Android may still require notification and exact alarm permission.
            </Text>
          </View>
        </ScrollView>
      </SettingsPageMotion>
    );
  }

  if (settingsPage === "reset") {
    return (
      <SettingsPageMotion page={settingsPage} direction={settingsDirection} colors={colors} isDark={isDark}>
        <ScreenTitle isDark={isDark}>Reset</ScreenTitle>
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Pressable style={styles.backRow} onPress={goSettingsMain}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Reset options</Text>
            <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
              These actions affect local data and signed-in Firestore sync data.
            </Text>
            <Button mode="outlined" textColor={colors.error} onPress={onResetStats}>
              Reset stats only
            </Button>
            <Button mode="contained" buttonColor={colors.error} onPress={onReset}>
              Reset all tasks
            </Button>
          </View>
        </ScrollView>
      </SettingsPageMotion>
    );
  }

  if (settingsPage === "notification") {
    return (
      <SettingsPageMotion page={settingsPage} direction={settingsDirection} colors={colors} isDark={isDark}>
        <ScreenTitle isDark={isDark}>Notification</ScreenTitle>
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Pressable style={styles.backRow} onPress={goSettingsMain}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]}>
            <SettingsSwitch
              isDark={isDark}
              colors={colors}
              title="Scheduled reminders"
              description="Allow VizMinder to schedule time-based alerts."
              value={settings.reminderNotifications !== false}
              onValueChange={(value) => onUpdateSettings({ reminderNotifications: value })}
            />
            <SettingsSwitch
              isDark={isDark}
              colors={colors}
              title="Full-screen alarm screen"
              description="Show the Yes/No reminder screen for Android alarm alerts."
              value={settings.fullScreenAlerts !== false}
              onValueChange={(value) => onUpdateSettings({ fullScreenAlerts: value })}
            />
            <SettingsSwitch
              isDark={isDark}
              colors={colors}
              title="Sound"
              description="Play the selected reminder ringtone."
              value={settings.notificationSound !== false}
              onValueChange={(value) => onUpdateSettings({ notificationSound: value })}
            />
            <SettingsSwitch
              isDark={isDark}
              colors={colors}
              title="Vibration"
              description="Allow Android alarm alerts to vibrate."
              value={settings.notificationVibration !== false}
              onValueChange={(value) => onUpdateSettings({ notificationVibration: value })}
            />
            <SettingsSwitch
              isDark={isDark}
              colors={colors}
              title="Follow-up reminders"
              description="Schedule extra alerts after a Yes or No response when a task enables follow-up."
              value={settings.followUpNotifications !== false}
              onValueChange={(value) => onUpdateSettings({ followUpNotifications: value })}
            />
            <Button
              mode="contained"
              buttonColor={colors.primary}
              onPress={async () => {
                const granted = await ensureNotificationPermission();
                onMessage(granted ? "Notification permission is enabled." : "Notification permission was not granted.");
              }}
            >
              Request notification permission
            </Button>
            <Button mode="outlined" textColor={colors.primary} onPress={() => Linking.openSettings()}>
              Open Android app notification settings
            </Button>
            <Button
              mode="text"
              textColor={colors.primary}
              onPress={async () => {
                const granted = await ensureNotificationPermission();
                if (!granted) {
                  onMessage("Notification permission was not granted.");
                  return;
                }
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: "VizMinder test notification",
                    body: "Notifications are enabled for installed APK builds.",
                    sound: settings.notificationSound === false ? null : "default",
                    priority: Notifications.AndroidNotificationPriority.MAX
                  },
                  trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: REMINDER_CHANNEL_ID }
                });
                onMessage("Test notification scheduled.");
              }}
            >
              Send test notification
            </Button>
          </View>
        </ScrollView>
      </SettingsPageMotion>
    );
  }

  return (
    <SettingsPageMotion page={settingsPage} direction={settingsDirection} colors={colors} isDark={isDark}>
      <ScreenTitle isDark={isDark}>Settings</ScreenTitle>
      <ScrollView contentContainerStyle={styles.settingsContent}>
        <Animatable.View animation="slideInUp" duration={440} delay={80} style={[styles.settingsList, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.materialCardDark]} useNativeDriver>
          {items.map(([icon, title, copy, action], index) => (
            <Animatable.View key={title} animation="slideInRight" duration={390} delay={140 + index * 55} useNativeDriver>
              <Pressable android_ripple={{ color: colors.surfaceVariant }} style={styles.settingsRow} onPress={action}>
                <MaterialCommunityIcons name={icon} size={24} color={colors.onSurfaceVariant} />
                <View style={styles.settingsCopy}>
                  <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>{title}</Text>
                  <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>{copy}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
              <Divider style={styles.settingsDivider} />
            </Animatable.View>
          ))}
        </Animatable.View>
      </ScrollView>
    </SettingsPageMotion>
  );
}

function SettingsPageMotion({ page, direction, colors, isDark, children }) {
  return (
    <Animatable.View
      key={`settings-${page}`}
      animation={direction === "forward" ? "slideInRight" : "slideInLeft"}
      duration={360}
      easing="ease-out-cubic"
      style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}
      useNativeDriver
    >
      {children}
    </Animatable.View>
  );
}

function SettingsSwitch({ title, description, value, onValueChange, isDark, colors }) {
  return (
    <View style={styles.settingsSwitchRow}>
      <View style={styles.settingsCopy}>
        <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>{title}</Text>
        <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>{description}</Text>
      </View>
      <Switch value={value} color={colors.primary} onValueChange={onValueChange} />
    </View>
  );
}

function BottomNav({ active, isDark, palette, taskCount = 0, onChange }) {
  const colors = palette || getPalette({}, isDark);
  const tabs = [
    ["home", "format-list-checks", "Tasks"],
    ["schedule", "calendar-month-outline", "Schedule"],
    ["stats", "chart-pie", "Stats"],
    ["account", "account-circle-outline", "Account"],
    ["settings", "cog-outline", "Settings"]
  ];

  return (
    <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.outline }, isDark && styles.bottomNavDark]}>
      {tabs.map(([key, icon, label]) => (
        <Pressable key={key} style={[styles.navItem, key === "stats" && styles.navItemRaised]} onPress={() => onChange(key)}>
          <View style={[
            styles.navIconWrap,
            key === "stats" && [styles.navIconRaised, { backgroundColor: active === key ? colors.primary : colors.primaryContainer }],
            key !== "stats" && active === key && { backgroundColor: colors.primaryContainer, borderRadius: 24 }
          ]}>
            <View style={styles.navIconAnchor}>
              <MaterialCommunityIcons name={icon} size={key === "stats" ? 28 : 24} color={key === "stats" && active === key ? colors.onPrimary : active === key ? colors.primary : colors.onSurfaceVariant} />
              {key === "home" && taskCount > 0 ? <View style={styles.notificationDot} /> : null}
            </View>
          </View>
          <Text style={[styles.navLabel, { color: active === key ? colors.primary : colors.onSurfaceVariant }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function VisualCue({ reminder, size, iconSize, compact = false, palette }) {
  const colors = palette || getPalette({}, false);
  const visualType = reminder.visualType || (reminder.imageUri ? "image" : "icon");
  if (visualType === "image" && reminder.imageUri) {
    return <Image source={{ uri: reminder.imageUri }} style={[styles.imagePlaceholder, { height: size, width: size }]} />;
  }

  if (visualType === "emoji") {
    const isCompact = compact || size <= 48;
    return (
      <View style={[isCompact ? styles.compactEmojiCueWrap : styles.imagePlaceholder, { backgroundColor: colors.primaryContainer, height: size, width: size }]}>
        <Text
          style={[
            styles.emojiCue,
            isCompact && styles.compactEmojiCue,
            isCompact
              ? { fontSize: iconSize, height: size, lineHeight: size, width: size }
              : { fontSize: iconSize, lineHeight: iconSize + 10 }
          ]}
        >
          {reminder.emoji || "\u{1F514}"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.imagePlaceholder, { backgroundColor: colors.primaryContainer, height: size, width: size }]}>
      <MaterialCommunityIcons name={reminder.icon || "bell-outline"} size={iconSize} color={colors.primary} />
    </View>
  );
}

function VisualSourcePicker({ reminder, isDark = false, palette, onUpdate, onAttachImage }) {
  const colors = palette || getPalette({}, isDark);
  const visualType = reminder.visualType || (reminder.imageUri ? "image" : "icon");
  return (
    <View style={[styles.visualPicker, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]}>
      <View style={styles.visualTabs}>
        {[
          ["image", "image-outline", "Photo"],
          ["icon", "shape-outline", "Icon"],
          ["emoji", "emoticon-outline", "Emoji"]
        ].map(([type, icon, label]) => (
          <Pressable
            key={type}
            style={[styles.visualTab, { borderColor: colors.outline }, isDark && styles.outlineOnDark, visualType === type && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => {
              if (type === "image") {
                onAttachImage();
                return;
              }
              onUpdate({ visualType: type });
            }}
          >
            <MaterialCommunityIcons name={icon} size={18} color={visualType === type ? colors.onPrimary : colors.primary} />
            <Text style={[styles.visualTabText, { color: colors.primary }, visualType === type && { color: colors.onPrimary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {visualType === "icon" ? (
        <View style={styles.choiceGrid}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              style={[styles.visualChoice, { backgroundColor: colors.surfaceVariant }, isDark && styles.inputOnDark, reminder.icon === icon && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => onUpdate({ visualType: "icon", icon })}
            >
              <MaterialCommunityIcons name={icon} size={24} color={reminder.icon === icon ? colors.onPrimary : colors.primary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {visualType === "emoji" ? (
        <View style={styles.choiceGrid}>
          {EMOJI_OPTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[styles.visualChoice, { backgroundColor: colors.surfaceVariant }, isDark && styles.inputOnDark, reminder.emoji === emoji && { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}
              onPress={() => onUpdate({ visualType: "emoji", emoji })}
            >
              <Text style={styles.emojiChoice}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PackageSummary({ compact = false }) {
  const rows = [

    ["confetti-cannon", "completion celebration"],
    ["animatable", "slide-in list feedback"],
    ["calendars", "month task distribution"],
    ["date-fns", "formatting and countdown"],
    ["image-picker", "photo visual cue"],
    ["async-storage", "restart-safe local data"],
    ["notifications", "real scheduled alerts"],
    ["gesture-handler", "native swipe delete"],
    ["datetimepicker", "native date/time picker"],
    ["haptics", "native tactile feedback"]
  ];

  return (
    <View style={[styles.packageBox, compact && styles.packageBoxCompact]}>
      <Text style={styles.sectionTitle}>Prototype packages</Text>
      {rows.map(([name, role]) => (
        <Text key={name} style={styles.packageText}>
          {name}: {role}
        </Text>
      ))}
    </View>
  );
}

async function configureNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "VizMinder reminders",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
    vibrationPattern: [0, 450, 200, 450],
    audioAttributes: {
      // ALARM usage makes Android treat the channel closer to a time-critical reminder.
      usage: Notifications.AndroidAudioUsage.ALARM
    }
  });
}

async function ensureNotificationPermission() {
  await configureNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true
    }
  });
  return requested.granted;
}

async function scheduleReminderNotification(reminder, settings = DEFAULT_SETTINGS) {
  if (reminder.timeSet === false || reminder.completed) {
    return null;
  }

  // Installed Android builds use the native AlarmManager full-screen alarm path.
  // Skipping Expo's parallel local notification prevents duplicate alarm sounds.
  if (Platform.OS === "android" && settings.fullScreenAlerts !== false) {
    await ensureNotificationPermission();
    return null;
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return null;
  }

  const trigger = getReminderNotificationTrigger(reminder);
  if (!trigger) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `VizMinder: ${reminder.title.trim() || "Reminder"}`,
      body: reminder.description?.trim() || "Time to check this reminder.",
      sound: settings.notificationSound === false ? null : "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        reminderId: reminder.id
      }
    },
    trigger
  });
}

function getReminderNotificationTrigger(reminder) {
  const scheduled = parseISO(reminder.scheduledAt);
  if (!isValid(scheduled)) {
    return null;
  }

  if (reminder.repeat) {
    if (!isRepeatStillActive(reminder, scheduled)) {
      return null;
    }
    if (Platform.OS === "ios") {
      return {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: scheduled.getHours(),
        minute: scheduled.getMinutes(),
        repeats: true
      };
    }

    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: scheduled.getHours(),
      minute: scheduled.getMinutes(),
      channelId: REMINDER_CHANNEL_ID
    };
  }

  const fireDate = getOneShotReminderDate(reminder, scheduled);
  if (fireDate <= new Date()) {
    return null;
  }
  const seconds = Math.max(1, Math.ceil((fireDate.getTime() - Date.now()) / 1000));

  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats: false,
    channelId: REMINDER_CHANNEL_ID
  };
}

function getOneShotReminderDate(reminder, scheduled) {
  if (reminder.hasDate !== false) {
    return scheduled;
  }

  const next = new Date();
  next.setHours(scheduled.getHours(), scheduled.getMinutes(), 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function getNextDailyDate(isoDate) {
  const scheduled = parseISO(isoDate);
  const next = new Date();
  next.setHours(scheduled.getHours(), scheduled.getMinutes(), 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function isRepeatStillActive(reminder, date = new Date()) {
  if (!reminder.repeatUntil) {
    return true;
  }
  const until = parseISO(reminder.repeatUntil);
  return isValid(until) ? date <= until : true;
}

function getNextFollowUpReminder(reminder) {
  if (!reminder.followUpEnabled || Number(reminder.followUpCount || 0) <= 0) {
    return null;
  }
  const next = new Date(Date.now() + Number(reminder.followUpIntervalMinutes || 5) * 60 * 1000);
  return {
    ...reminder,
    scheduledAt: next.toISOString(),
    completed: false,
    followUpCount: Math.max(0, Number(reminder.followUpCount || 0) - 1)
  };
}

function shouldShowReminderOnDate(reminder, dateString) {
  if (reminder.completed) {
    return false;
  }
  const scheduled = parseISO(reminder.scheduledAt);
  if (!isValid(scheduled)) {
    return false;
  }
  const selected = parseISO(dateString);
  if (!isValid(selected)) {
    return false;
  }
  const selectedDay = toDayKey(selected);
  const scheduledDay = toDayKey(scheduled);
  const startDay = getReminderStartDay(reminder, scheduled);

  if (!reminder.repeat) {
    const oneShotDay = reminder.hasDate === false ? getNextFloatingReminderDay(scheduled) : scheduledDay;
    return oneShotDay === selectedDay;
  }

  if (selectedDay < startDay) {
    return false;
  }

  if (reminder.repeatUntil) {
    const until = parseISO(reminder.repeatUntil);
    if (isValid(until) && selectedDay > toDayKey(until)) {
      return false;
    }
  }

  return true;
}

function getReminderStartDay(reminder, scheduled) {
  if (reminder.hasDate !== false) {
    return toDayKey(scheduled);
  }
  const created = reminder.createdAt && isValid(parseISO(reminder.createdAt)) ? parseISO(reminder.createdAt) : scheduled;
  return toDayKey(created);
}

function getNextFloatingReminderDay(scheduled) {
  const next = new Date();
  next.setHours(scheduled.getHours(), scheduled.getMinutes(), 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return toDayKey(next);
}

function toDayKey(date) {
  return format(date, "yyyy-MM-dd");
}

function buildScheduleMarkedDates(reminders, visibleMonth, color) {
  const [yearText, monthText] = visibleMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) {
    return {};
  }
  const days = new Date(year, month, 0).getDate();
  const marks = {};
  for (let day = 1; day <= days; day += 1) {
    const dateString = `${yearText}-${monthText}-${String(day).padStart(2, "0")}`;
    if (reminders.some((reminder) => shouldShowReminderOnDate(reminder, dateString))) {
      marks[dateString] = { marked: true, dotColor: color };
    }
  }
  return marks;
}

function getCountdownLabel(isoDate) {
  const target = parseISO(isoDate);
  const now = new Date();
  if (target < now) {
    return "due now";
  }
  return `${formatDistanceStrict(target, now)} left`;
}

function clampNumber(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, parsed));
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: SURFACE,
    flex: 1
  },
  safeAreaDark: {
    backgroundColor: "#141218"
  },
  textOnDark: {
    color: "#E6E0E9"
  },
  mutedOnDark: {
    color: "#CAC4D0"
  },
  primaryOnDark: {
    color: "#D0BCFF"
  },
  cardOnDark: {
    backgroundColor: "#211F26",
    borderColor: "#49454F"
  },
  inputOnDark: {
    backgroundColor: "#2B2930",
    borderColor: "#5F5A66"
  },
  surfaceVariantOnDark: {
    backgroundColor: "#2B2930",
    borderColor: "#5F5A66"
  },
  outlineOnDark: {
    borderColor: "#5F5A66"
  },
  flex: {
    flex: 1
  },
  screen: {
    backgroundColor: BG,
    flex: 1,
    paddingBottom: 78
  },
  screenDark: {
    backgroundColor: "#141218"
  },
  titleWrap: {
    alignItems: "center",
    minHeight: 72,
    justifyContent: "center",
    paddingBottom: 10,
    paddingTop: 22
  },
  screenTitle: {
    color: TEXT,
    fontFamily: FONT_SEMIBOLD,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 0.15
  },
  titleAction: {
    position: "absolute",
    right: 16,
    top: 10
  },
  topAction: {
    alignItems: "center",
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  formTopBar: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  formTitle: {
    color: TEXT,
    flex: 1,
    fontSize: 22,
    fontWeight: "600"
  },
  formContent: {
    padding: 16,
    paddingBottom: 28
  },
  formCard: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16
  },
  visualCueRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  visualCueCopy: {
    flex: 1,
    gap: 6
  },
  formCardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600"
  },
  formHelper: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  formInput: {
    backgroundColor: SURFACE,
    marginTop: 10
  },
  schedulePickerRow: {
    flexDirection: "row",
    gap: 10
  },
  schedulePicker: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 16,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 12
  },
  pickerLabel: {
    color: MUTED,
    fontSize: 12
  },
  pickerValue: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600"
  },
  formActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    paddingTop: 2
  },
  deleteButton: {
    marginRight: "auto"
  },
  homeList: {
    paddingBottom: 102,
    paddingTop: 4
  },
  emptyHome: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 36,
    paddingTop: 96
  },
  emptyVisual: {
    alignItems: "center",
    backgroundColor: LIGHT_PURPLE,
    borderRadius: 46,
    height: 92,
    justifyContent: "center",
    width: 92
  },
  emptyTitle: {
    color: TEXT,
    fontFamily: FONT_BOLD,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8
  },
  materialCard: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    padding: 14
  },
  materialCardDark: {
    backgroundColor: "#211F26",
    borderColor: "#49454F"
  },
  scheduleContent: {
    padding: 16,
    paddingBottom: 96
  },
  statsContent: {
    gap: 14,
    padding: 16,
    paddingBottom: 104
  },
  statsHero: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18
  },
  statsHeroLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  statsHeroCopy: {
    color: MUTED,
    fontFamily: FONT_REGULAR,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "center"
  },
  pieWrap: {
    alignItems: "center",
    height: 156,
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 14,
    width: 156
  },
  pieCenter: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute"
  },
  pieCenterValue: {
    fontFamily: FONT_BOLD,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36
  },
  pieCenterLabel: {
    color: MUTED,
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  pieLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 14
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  legendSwatch: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  legendLabel: {
    color: MUTED,
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    fontWeight: "700"
  },
  statsCardGrid: {
    flexDirection: "row",
    gap: 10
  },
  statsMiniCard: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    minHeight: 112,
    padding: 12
  },
  statsMiniValue: {
    fontFamily: FONT_BOLD,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6
  },
  statsMiniLabel: {
    color: MUTED,
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  riskRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8
  },
  riskCopy: {
    flex: 1
  },
  statsInsightCard: {
    alignItems: "center"
  },
  statsInsightTitle: {
    textAlign: "center"
  },
  statsInsightCopy: {
    color: MUTED,
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    maxWidth: 260,
    textAlign: "center"
  },
  scheduleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10
  },
  scheduleCopy: {
    flex: 1
  },
  emptySchedule: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 22
  },
  emptyText: {
    color: MUTED,
    fontFamily: FONT_REGULAR,
    fontSize: 14
  },
  emptyTextCentered: {
    maxWidth: 260,
    textAlign: "center"
  },
  swipeDeleteAction: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: ERROR,
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginRight: 14,
    marginVertical: 6,
    paddingHorizontal: 18,
    width: 112
  },
  swipeDeleteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  taskRow: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 14,
    marginVertical: 6,
    minHeight: 70,
    overflow: "visible",
    paddingHorizontal: 16
  },
  visualBubble: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    overflow: "visible",
    width: 44
  },
  taskCopy: {
    flex: 1,
    paddingHorizontal: 14
  },
  taskTime: {
    color: PURPLE,
    fontFamily: FONT_BOLD,
    fontSize: 12,
    fontWeight: "700"
  },
  taskTitle: {
    color: TEXT,
    fontFamily: FONT_SEMIBOLD,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22
  },
  taskDescription: {
    color: MUTED,
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    lineHeight: 18
  },
  taskActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  testButton: {
    alignItems: "center",
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  searchDock: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 28,
    bottom: 96,
    elevation: 7,
    flexDirection: "row",
    height: 56,
    justifyContent: "space-between",
    left: 18,
    paddingLeft: 16,
    paddingRight: 8,
    position: "absolute",
    right: 18,
    shadowColor: "#000000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10
  },
  searchDockInput: {
    backgroundColor: "transparent",
    flex: 1,
    height: 46,
    marginHorizontal: 6,
    paddingHorizontal: 0
  },
  addButton: {
    alignItems: "center",
    backgroundColor: PURPLE,
    borderRadius: 20,
    height: 42,
    justifyContent: "center",
    width: 48
  },
  reminderScreen: {
    alignItems: "center",
    backgroundColor: BG,
    flex: 1,
    paddingHorizontal: 18
  },
  reminderCopy: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%"
  },
  reminderHeadline: {
    color: PURPLE,
    fontFamily: FONT_BOLD,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 26,
    textAlign: "center"
  },
  reminderQuestion: {
    color: PURPLE,
    fontFamily: FONT_BOLD,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center"
  },
  confirmMemoryButton: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    minHeight: 44,
    paddingHorizontal: 18
  },
  confirmMemoryText: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    fontWeight: "800"
  },
  answerRow: {
    flexDirection: "row",
    gap: 44,
    marginBottom: 82
  },
  answerButton: {
    alignItems: "center",
    borderRadius: 52,
    height: 104,
    justifyContent: "center",
    width: 104
  },
  answerNo: {
    backgroundColor: PURPLE
  },
  answerYes: {
    backgroundColor: "#C8B4FF"
  },
  editContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  imageEditWrap: {
    marginBottom: 14
  },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 24,
    justifyContent: "center"
  },
  emojiCue: {
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center"
  },
  compactEmojiCueWrap: {
    alignItems: "center",
    backgroundColor: "transparent",
    justifyContent: "center",
    overflow: "visible"
  },
  compactEmojiCue: {
    includeFontPadding: false,
    padding: 0,
    textAlignVertical: "center"
  },
  visualPicker: {
    alignItems: "center",
    borderColor: LINE,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
    padding: 12,
    width: "100%"
  },
  visualTabs: {
    flexDirection: "row",
    gap: 8,
    width: "100%"
  },
  visualTab: {
    alignItems: "center",
    borderColor: LINE,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8
  },
  visualTabActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE
  },
  visualTabText: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: "700"
  },
  visualTabTextActive: {
    color: "#FFFFFF"
  },
  choiceGrid: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    width: "100%"
  },
  visualChoice: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 18,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  visualChoiceActive: {
    backgroundColor: PURPLE
  },
  emojiChoice: {
    fontSize: 22
  },
  placeholderShapes: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  editFab: {
    alignItems: "center",
    backgroundColor: PURPLE,
    borderRadius: 18,
    bottom: 6,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    width: 36
  },
  editField: {
    alignItems: "center",
    borderColor: LINE,
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    minHeight: 62,
    paddingHorizontal: 16,
    width: "100%"
  },
  editTextField: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: "100%"
  },
  editTextFieldTall: {
    minHeight: 94
  },
  editLabel: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700"
  },
  editTextInput: {
    backgroundColor: "transparent",
    fontSize: 16,
    marginTop: 2,
    paddingHorizontal: 0
  },
  editTextInputTall: {
    minHeight: 54
  },
  numberFieldHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  numberInputRow: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 10
  },
  numberInput: {
    backgroundColor: "transparent",
    flex: 1,
    fontSize: 18,
    paddingHorizontal: 0
  },
  importantRow: {
    alignItems: "center",
    borderColor: LINE,
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: "100%"
  },
  importantHelp: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2
  },
  editValue: {
    alignItems: "center",
    backgroundColor: "#E6E0E8",
    borderRadius: 14,
    flexDirection: "row",
    height: 44,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    width: "55%"
  },
  editValueText: {
    color: MUTED,
    fontSize: 16
  },
  editActions: {
    alignItems: "center",
    borderTopColor: LINE,
    borderTopWidth: 1,
    bottom: 68,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    left: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: "absolute",
    right: 0
  },
  actionButton: {
    borderRadius: 28
  },
  accountCard: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 22,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  avatar: {
    alignItems: "center",
    backgroundColor: LIGHT_PURPLE,
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  accountName: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700"
  },
  accountPlan: {
    color: TEXT,
    fontSize: 16,
    marginTop: 4
  },
  planBlock: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  planTitle: {
    color: TEXT,
    fontSize: 18,
    marginBottom: 12
  },
  planCopy: {
    color: MUTED,
    fontSize: 14,
    marginBottom: 8
  },
  planActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 16
  },
  planButton: {
    borderRadius: 28
  },
  accountContent: {
    gap: 14,
    paddingBottom: 112
  },
  authInput: {
    borderRadius: 12,
    marginBottom: 10
  },
  progressTrack: {
    borderRadius: 6,
    height: 8,
    marginBottom: 14,
    overflow: "hidden",
    width: "100%"
  },
  progressFill: {
    height: "100%"
  },
  syncList: {
    gap: 8,
    marginTop: 14
  },
  syncRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  syncStatus: {
    fontSize: 12,
    fontWeight: "700"
  },
  syncOk: {
    color: SUCCESS
  },
  syncWarn: {
    color: ERROR
  },
  syncError: {
    color: ERROR,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8
  },
  settingsList: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: "hidden"
  },
  settingsContent: {
    paddingBottom: 104
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 44
  },
  settingsPanel: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16
  },
  segmentedControl: {
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 22,
    flexDirection: "row",
    padding: 4
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    minHeight: 36,
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: PURPLE
  },
  segmentText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700"
  },
  segmentTextActive: {
    color: "#FFFFFF"
  },
  settingsSwitchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  settingsRow: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  settingsCopy: {
    flex: 1
  },
  settingsTitle: {
    color: TEXT,
    fontSize: 18,
    marginBottom: 4
  },
  settingsDescription: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20
  },
  settingsDivider: {
    backgroundColor: LINE,
    height: 1
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderTopColor: LINE,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    height: 78,
    justifyContent: "space-around",
    left: 0,
    paddingBottom: 8,
    paddingTop: 6,
    position: "absolute",
    right: 0
  },
  bottomNavDark: {
    backgroundColor: "#211F26",
    borderTopColor: "#49454F"
  },
  navItem: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0
  },
  navItemRaised: {
    marginTop: -24
  },
  navIconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 32,
    justifyContent: "center",
    width: 48
  },
  navIconRaised: {
    borderRadius: 32,
    elevation: 6,
    height: 62,
    shadowColor: "#000000",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    width: 62
  },
  navIconActive: {
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 18
  },
  navIconAnchor: {
    height: 28,
    position: "relative",
    width: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  notificationDot: {
    backgroundColor: "#C32922",
    borderColor: SURFACE,
    borderRadius: 5,
    borderWidth: 1,
    height: 9,
    position: "absolute",
    right: 1,
    top: 1,
    width: 9
  },
  navLabel: {
    color: "#56515E",
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2
  },
  modalLayer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 248, 255, 0.74)"
  },
  timeDialog: {
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 24,
    padding: 18,
    width: "82%"
  },
  dialogLabel: {
    color: MUTED,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 18
  },
  timeInputs: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center"
  },
  timeInput: {
    backgroundColor: "#E9DFFF",
    fontSize: 28,
    height: 58,
    textAlign: "center",
    width: 88
  },
  colon: {
    color: TEXT,
    fontSize: 30,
    paddingHorizontal: 8
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20
  },
  inputHelp: {
    color: MUTED,
    fontSize: 13
  },
  dialogActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  dialogIconGroup: {
    flexDirection: "row",
    gap: 4
  },
  dialogButtonRow: {
    flexDirection: "row",
    gap: 12
  },
  dialogIconButton: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  clockPicker: {
    alignItems: "center",
    marginBottom: 18
  },
  clockStepLabel: {
    alignSelf: "flex-start",
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8
  },
  clockReadout: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12
  },
  clockReadoutSegment: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 12,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  clockReadoutSegmentActive: {
    backgroundColor: PRIMARY_CONTAINER
  },
  clockReadoutText: {
    color: TEXT,
    fontSize: 30,
    fontWeight: "600"
  },
  clockReadoutTextActive: {
    color: PURPLE
  },
  clockReadoutColon: {
    color: TEXT,
    fontSize: 28,
    paddingHorizontal: 8
  },
  clockFace: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 92,
    height: 184,
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
    width: 184
  },
  clockNumber: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    width: 36
  },
  clockNumberActive: {
    backgroundColor: PURPLE
  },
  clockNumberText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600"
  },
  clockNumberTextActive: {
    color: "#FFFFFF"
  },
  clockCenter: {
    backgroundColor: PURPLE,
    borderRadius: 4,
    height: 8,
    position: "absolute",
    width: 8
  },
  clockHand: {
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 2,
    height: 70,
    position: "absolute",
    top: 24,
    width: 4
  },
  minuteChips: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 6
  },
  minuteChip: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  minuteChipActive: {
    backgroundColor: PRIMARY_CONTAINER
  },
  minuteChipText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600"
  },
  minuteChipTextActive: {
    color: PURPLE
  },
  dateDialog: {
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 24,
    maxHeight: "86%",
    paddingTop: 18,
    paddingBottom: 14,
    width: "90%"
  },
  dateDialogTitle: {
    color: MUTED,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingBottom: 8
  },
  dateHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  dateHeading: {
    color: TEXT,
    fontSize: 24
  },
  dateTextInput: {
    backgroundColor: SURFACE_VARIANT,
    flex: 1
  },
  dialogCalendar: {
    height: 334,
    paddingHorizontal: 8,
    paddingTop: 8,
    overflow: "hidden"
  },
  dateActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10
  },
  repeatText: {
    color: PURPLE,
    fontSize: 15,
    fontWeight: "700"
  },
  calendarSection: {
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6
  },
  packageBox: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  packageBoxCompact: {
    paddingTop: 18
  },
  packageText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18
  }
});



