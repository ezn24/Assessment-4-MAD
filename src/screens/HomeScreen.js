import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Animatable from "react-native-animatable";
// expo-haptics adds native tactile feedback to completion, toggle, and delete actions.
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
// Native date/time picker is kept as an escape hatch beside the custom Material-style picker.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { format, formatDistanceStrict, isValid, parseISO, set } from "date-fns";
import { Calendar } from "react-native-calendars";
import { Button, Card, Divider, Snackbar, Switch, Surface, Text, TextInput, Portal, Dialog, IconButton, FAB, Chip, Badge } from "react-native-paper";
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
import { getAccelerometerData, getGyroscopeData, toggleTorch, getTorchAvailability } from "../services/sensors";
import { getCurrentLocation, LocationMap } from "../services/location";
import { getBatteryInfo, subscribeToBatteryLevel } from "../services/battery";
import { isBiometricAvailable, authenticateBiometric } from "../services/biometrics";
import { getNetworkState, subscribeToNetworkState } from "../services/connectivity";
import { encryptReminder, decryptReminder } from "../services/encryption";

let BannerAdComponent, preloadInterstitial, Notifications;
if (Platform.OS !== "web") {
  try {
    const admob = require("../services/admob");
    BannerAdComponent = admob.BannerAdComponent;
    preloadInterstitial = admob.preloadInterstitial;
  } catch (e) {
    console.warn("AdMob not available:", e);
  }
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      })
    });
  } catch (e) {
    console.warn("Notifications not available:", e);
  }
}

const PURPLE = "#007AFF";
const LIGHT_PURPLE = "#E5F1FF";
const BG = "#F5F5F7";
const TEXT = "#1D1D1F";
const MUTED = "#86868B";
const LINE = "#E5E5EA";
const SURFACE = "#FFFFFF";
const SURFACE_VARIANT = "#F2F2F7";
const PRIMARY_CONTAINER = "#E5F1FF";
const ERROR = "#FF3B30";
const SUCCESS = "#34C759";
const DATE_DISPLAY_FORMAT = "yyyy/MM/dd";
const DATE_INPUT_PLACEHOLDER = "yyyy/mm/dd";
const REMINDER_CHANNEL_ID = "vizminder-a4-reminders";
const DEFAULT_SETTINGS = {
  themeMode: "light",
  followSystemColors: true,
  showReminderDebugButton: false,
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
const FOLLOW_UP_COUNTS = [0, 1, 2, 3, 5, 10];
const FOLLOW_UP_INTERVALS = [1, 3, 5, 10, 15, 30];
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
const CATEGORY_OPTIONS = [
  { name: "General", color: "#86868B" },
  { name: "Work", color: "#007AFF" },
  { name: "Personal", color: "#34C759" },
  { name: "Health", color: "#FF9500" },
  { name: "Shopping", color: "#FF2D55" },
  { name: "Finance", color: "#5856D6" },
  { name: "Social", color: "#FF9F0A" },
  { name: "Learning", color: "#30D158" }
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
    ringtone: "alarm",
    important: true,
    completed: false,
    imageUri: null,
    streak: 0
  };
}

export default function HomeScreen({ settings: appSettings = DEFAULT_SETTINGS, onUpdateSettings, isDarkOverride = null, themeColors = {} }) {
  const { reminders, markedDates, updateReminder, addReminder, deleteReminder, resetPrototype, refreshFromCloud, syncNow, loaded } = useReminders();
  const confettiRef = useRef(null);
  const remindersRef = useRef(reminders);
  const lastCloudUserRef = useRef(null);
  const isDeletingRef = useRef(false);
  const [tab, setTab] = useState("home");
  const [editing, setEditing] = useState(null);
  const [editMode, setEditMode] = useState("edit");
  const [reminding, setReminding] = useState(null);
  const [message, setMessage] = useState("");
  const [undoDelete, setUndoDelete] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [batteryInfo, setBatteryInfo] = useState(null);
  const [networkState, setNetworkState] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const settings = { ...DEFAULT_SETTINGS, ...appSettings };
  const activeScheme = settings.themeMode;
  const isDark = typeof isDarkOverride === "boolean" ? isDarkOverride : activeScheme === "dark";
  const palette = useMemo(() => getPalette(themeColors, isDark), [themeColors, isDark]);
  const themedSurface = palette.surface;

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const isSmallScreen = screenWidth < 375;
  const isLargeScreen = screenWidth > 414;

  const firstReminder = reminders[0];
  const activeReminder = reminding || firstReminder;
  const completedCount = useMemo(() => reminders.filter((item) => item.completed).length, [reminders]);

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
    refreshFromCloud(authUser.uid).catch(() => {});
  }, [authUser, refreshFromCloud]);

  useEffect(() => {
    getBatteryInfo().then(setBatteryInfo).catch(() => {});
    const batterySubscription = subscribeToBatteryLevel((level) => {
      setBatteryInfo((prev) => prev ? { ...prev, level } : { level, state: null, isLow: level < 20, isCharging: false });
    });
    return () => batterySubscription?.remove();
  }, []);

  useEffect(() => {
    getNetworkState().then(setNetworkState).catch(() => {});
    const networkSubscription = subscribeToNetworkState((state) => setNetworkState(state));
    return () => networkSubscription?.remove();
  }, []);

  useEffect(() => {
    getCurrentLocation().then(setCurrentLocation).catch(() => {});
  }, []);

  useEffect(() => {
    isBiometricAvailable().then((result) => setBiometricAvailable(result.available)).catch(() => {});
  }, []);

  useEffect(() => {
    getTorchAvailability().then((result) => setTorchAvailable(result.available)).catch(() => {});
  }, []);

  useEffect(() => {
    if (preloadInterstitial) {
      preloadInterstitial().catch(() => {});
    }
  }, []);

  const updateSettings = (patch) => {
    onUpdateSettings?.(patch);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (authUser && !authUser.isAnonymous) {
      await refreshFromCloud(authUser.uid).catch(() => {});
    }
    setTimeout(() => setRefreshing(false), 500);
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
    if (Platform.OS === "android" && Notifications) {
      // Android reminders now use the native full-screen alarm path.
      // Clear legacy Expo reminder schedules from older APKs so they do not ring in parallel.
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }

    if (!Notifications) {
      return;
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

  const handlePromptResponse = async (reminder, completed) => {
    if (reminder.notificationId && Notifications) {
      Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
    }
    cancelNativeAlarm(reminder.id).catch(() => {});
    const followUpReminder = settings.followUpNotifications === false ? null : getNextFollowUpReminder(reminder);
    if (followUpReminder) {
      const notificationId = await scheduleReminderAlarms(followUpReminder);
      updateReminder(reminder.id, { ...followUpReminder, notificationId });
    } else if (reminder.repeat && isRepeatStillActive(reminder)) {
      const nextReminder = {
        ...reminder,
        scheduledAt: getNextDailyDate(reminder.scheduledAt).toISOString(),
        completed: false,
        completedAt: completed ? new Date().toISOString() : reminder.completedAt || null,
        streak: completed ? (reminder.streak || 0) + 1 : reminder.streak || 0
      };
      const notificationId = await scheduleReminderAlarms(nextReminder);
      updateReminder(reminder.id, { ...nextReminder, notificationId });
    } else if (!completed) {
      updateReminder(reminder.id, { notificationId: null });
    } else {
      updateReminder(reminder.id, {
        completed: true,
        completedAt: new Date().toISOString(),
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
    setDeleting(true);
    try {
      if (reminder.notificationId && Notifications) {
        await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
      }
      await cancelNativeAlarm(reminder.id).catch(() => false);
      deleteReminder(reminder.id);
      setUndoDelete(reminder);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setMessage("Reminder deleted.");
      setTimeout(() => setDeleting(false), 300);
      afterDelete?.();
    } catch (error) {
      setMessage("Failed to delete reminder.");
      setDeleting(false);
    }
  };

  const confirmDeleteReminder = (reminder, afterDelete) => {
    if (deleting || isDeletingRef.current) {
      return;
    }
    isDeletingRef.current = true;
    console.log("confirmDeleteReminder called for:", reminder.id);
    const doDelete = () => {
      console.log("Delete confirmed for:", reminder.id);
      setDeleting(true);
      deleteReminderWithUndo(reminder, afterDelete);
      setTimeout(() => {
        isDeletingRef.current = false;
      }, 500);
    };
    const doCancel = () => {
      isDeletingRef.current = false;
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Delete reminder? This removes the reminder and cancels its scheduled alarm.")) {
        doDelete();
      } else {
        doCancel();
      }
      return;
    }
    Alert.alert("Delete reminder?", "This removes the reminder and cancels its scheduled alarm.", [
      { text: "Cancel", style: "cancel", onPress: doCancel },
      { text: "Delete", style: "destructive", onPress: doDelete }
    ]);
  };

  const confirmResetReminders = () => {
    Alert.alert("Reset all reminders?", "This deletes every reminder on this device and cancels scheduled alerts. This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          if (Notifications) {
            await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
          }
          await Promise.all(reminders.map((reminder) => cancelNativeAlarm(reminder.id).catch(() => false)));
          resetPrototype();
          setUndoDelete(null);
          setMessage("Reminder data reset.");
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
          <ReminderPrompt reminder={activeReminder} isDark={isDark} palette={palette} onNo={() => handlePromptResponse(activeReminder, false)} onYes={() => handlePromptResponse(activeReminder, true)} />
        ) : editing ? (
          <TaskEditScreen
            reminder={editing}
            mode={editMode}
            isDark={isDark}
            palette={palette}
            saving={saving}
            deleting={deleting}
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
              setSaving(true);
              try {
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
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                } else {
                  if (editing.notificationId && Notifications) {
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
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                }
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 1500);
                setTimeout(() => setEditing(null), 300);
              } catch (error) {
                console.error("Save reminder error:", error);
                setMessage(`Failed to save reminder: ${error.message || error}`);
              } finally {
                setSaving(false);
              }
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
            <Animatable.View key={tab} animation="fadeIn" duration={400} style={styles.flex} useNativeDriver>
              {tab === "home" ? (
                <HomeTab
                  reminders={reminders}
                  loaded={loaded}
                  markedDates={markedDates}
                  onTestReminder={setReminding}
                  showReminderDebugButton={settings.showReminderDebugButton}
                  isDark={isDark}
                  themeColors={themeColors}
                  palette={palette}
                  onRefresh={onRefresh}
                  refreshing={refreshing}
                  onEdit={(reminder) => {
                    setEditMode("edit");
                    setEditing({ ...reminder });
                  }}
                  onToggle={async (reminder, completed) =>
                    {
                      console.log("Toggle reminder:", reminder.id, "completed:", completed);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      if (reminder.notificationId && Notifications) {
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
                  isSmallScreen={isSmallScreen}
                  isLargeScreen={isLargeScreen}
                />
              ) : tab === "schedule" ? (
                <ScheduleTab
                  markedDates={markedDates}
                  reminders={reminders}
                  isDark={isDark}
                  palette={palette}
                  onRefresh={onRefresh}
                  refreshing={refreshing}
                  onEdit={(reminder) => {
                    setEditMode("edit");
                    setEditing({ ...reminder });
                  }}
                  isSmallScreen={isSmallScreen}
                  isLargeScreen={isLargeScreen}
                />
              ) : tab === "stats" ? (
                <StatsTab
                  reminders={reminders}
                  completedCount={completedCount}
                  isDark={isDark}
                  palette={palette}
                  isSmallScreen={isSmallScreen}
                  isLargeScreen={isLargeScreen}
                />
              ) : tab === "account" ? (
                <AccountTab
                  reminders={reminders}
                  authUser={authUser}
                  completedCount={completedCount}
                  isDark={isDark}
                  palette={palette}
                  onSyncNow={syncNow}
                  onMessage={setMessage}
                  isSmallScreen={isSmallScreen}
                  isLargeScreen={isLargeScreen}
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onReset={confirmResetReminders}
                />
              ) : tab === "device" ? (
                <DeviceTab
                  batteryInfo={batteryInfo}
                  networkState={networkState}
                  currentLocation={currentLocation}
                  biometricAvailable={biometricAvailable}
                  torchAvailable={torchAvailable}
                  showMap={showMap}
                  setShowMap={setShowMap}
                  reminders={reminders}
                  isDark={isDark}
                  palette={palette}
                  onMessage={setMessage}
                  onRefreshBattery={() => {
                    getBatteryInfo().then((info) => {
                      setBatteryInfo(info);
                      setMessage(info ? "Battery refreshed" : "Battery unavailable");
                    }).catch(() => setMessage("Battery refresh failed"));
                  }}
                  onRefreshNetwork={() => {
                    getNetworkState().then((state) => {
                      setNetworkState(state);
                      setMessage(state?.isConnected ? "Network refreshed" : "Network offline");
                    }).catch(() => setMessage("Network refresh failed"));
                  }}
                  onRefreshLocation={() => {
                    getCurrentLocation().then((loc) => {
                      setCurrentLocation(loc);
                      setMessage(loc ? "Location refreshed" : "Location unavailable - permission denied?");
                    }).catch(() => setMessage("Location refresh failed"));
                  }}
                  isSmallScreen={isSmallScreen}
                  isLargeScreen={isLargeScreen}
                />
              ) : null}
            </Animatable.View>
            <BottomNav active={tab} isDark={isDark} palette={palette} onChange={setTab} />
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
      {showSuccess ? (
        <Animatable.View animation="bounceIn" duration={600} style={styles.successOverlay}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-circle" size={64} color={SUCCESS} />
          </View>
          <Text style={styles.successText}>Saved!</Text>
        </Animatable.View>
      ) : null}
      <Animatable.View animation="slideInDown" duration={400} style={styles.notificationContainer}>
        <Snackbar
          visible={Boolean(message)}
          onDismiss={() => {
            setMessage("");
            setUndoDelete(null);
          }}
          duration={4200}
          style={{ backgroundColor: SUCCESS }}
          action={undoDelete ? { label: "Undo", onPress: restoreDeletedReminder, labelStyle: { color: "#FFFFFF" } } : undefined}
          theme={{ colors: { surface: SUCCESS, onSurface: "#FFFFFF" } }}
        >
          <Text style={styles.notificationText}>{message}</Text>
        </Snackbar>
      </Animatable.View>
      {tab === "home" && BannerAdComponent && <BannerAdComponent style={styles.bannerAd} />}
    </SafeAreaView>
  );
}

function ScreenTitle({ children, action, isDark = false }) {
  return (
    <View style={styles.titleWrap}>
      <Text
        style={[styles.screenTitle, isDark && styles.textOnDark]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >{children}</Text>
      {action ? <View style={styles.titleAction}>{action}</View> : null}
    </View>
  );
}

function HomeTab({ reminders, loaded, markedDates, onTestReminder, showReminderDebugButton, isDark, themeColors = {}, palette, onEdit, onToggle, onAdd, onDelete, onRefresh, refreshing, isSmallScreen, isLargeScreen }) {
  const [query, setQuery] = useState("");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const isDeletingRef = useRef(false);
  const colors = palette || getPalette(themeColors, isDark);
  const primary = colors.primary;
  
  const today = format(new Date(), "yyyy-MM-dd");
  const visibleReminders = reminders.filter((reminder) => {
    const haystack = `${reminder.title} ${reminder.description || ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesToday = showTodayOnly ? format(parseISO(reminder.scheduledAt), "yyyy-MM-dd") === today : true;
    return matchesQuery && matchesToday;
  });

  const handleDelete = (reminder) => {
    if (isDeletingRef.current || deletingId === reminder.id) {
      return;
    }
    isDeletingRef.current = true;
    setDeletingId(reminder.id);
    onDelete(reminder);
    setTimeout(() => {
      isDeletingRef.current = false;
      setDeletingId(null);
    }, 500);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Reminders</ScreenTitle>
      <FlatList
        style={styles.flex}
        contentContainerStyle={[styles.homeList, isSmallScreen && styles.homeListCompact]}
        showsVerticalScrollIndicator={false}
        data={visibleReminders}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !loaded ? (
            <Animatable.View animation="fadeIn" duration={400} style={styles.emptyHome}>
              <View style={[styles.emptyVisual, { backgroundColor: colors.primaryContainer }]}>
                <MaterialCommunityIcons name="loading" size={64} color={primary} />
              </View>
              <Text style={[styles.emptyTitle, isDark && styles.textOnDark]}>Loading reminders</Text>
              <Text style={[styles.emptyText, isDark && styles.mutedOnDark]}>Restoring your local data...</Text>
            </Animatable.View>
          ) : (
            <Animatable.View animation="fadeInUp" duration={500} style={styles.emptyHome}>
              <View style={[styles.emptyVisual, { backgroundColor: colors.primaryContainer }]}>
                <MaterialCommunityIcons name="bell-ring-outline" size={72} color={primary} />
              </View>
              <Text style={[styles.emptyTitle, isDark && styles.textOnDark]}>No reminders yet</Text>
              <Text style={[styles.emptyText, isDark && styles.mutedOnDark]}>Tap the + button to create your first reminder</Text>
              <Text style={[styles.emptySubtext, isDark && styles.mutedOnDark]}>Stay organized and never forget important tasks</Text>
            </Animatable.View>
          )
        }
        renderItem={({ item: reminder, index }) => (
          <Animatable.View 
            animation={deletingId === reminder.id ? "slideOutRight" : "fadeInUp"} 
            delay={deletingId === reminder.id ? 0 : index * 60} 
            duration={deletingId === reminder.id ? 350 : 320} 
            useNativeDriver
          >
            <Card
              style={[
                styles.taskRow,
                isSmallScreen && styles.taskRowCompact,
                isDark && styles.cardOnDark
              ]}
              onPress={() => onEdit(reminder)}
              elevation={3}
              mode="elevated"
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.taskMain}>
                  <View style={styles.visualBubble}>
                    <VisualCue reminder={reminder} size={isSmallScreen ? 40 : 48} iconSize={isSmallScreen ? 20 : 24} compact palette={colors} />
                  </View>
                  <View style={styles.taskCopy}>
                    <View style={styles.taskHeader}>
                      <Text style={[styles.taskTime, { color: primary }]}>
                        {format(parseISO(reminder.scheduledAt), "h:mm a")} · {getCountdownLabel(reminder.scheduledAt)}
                      </Text>
                      {reminder.priority === "high" && (
                        <Chip icon="flag" compact mode="flat" style={styles.priorityChip} textStyle={styles.chipText}>High</Chip>
                      )}
                    </View>
                    <Text style={[styles.taskTitle, isDark && styles.textOnDark]}>{reminder.title}</Text>
                    {reminder.description ? <Text style={[styles.taskDescription, isDark && styles.mutedOnDark]}>{reminder.description}</Text> : null}
                  </View>
                </View>
                <View style={styles.taskActions}>
                  {showReminderDebugButton ? (
                    <IconButton icon="play-circle-outline" size={24} iconColor={primary} onPress={() => onTestReminder(reminder)} />
                  ) : null}
                  <IconButton icon="pencil" size={20} iconColor={colors.onSurfaceVariant} onPress={() => onEdit(reminder)} />
                  <IconButton 
                    icon="trash-can" 
                    size={20} 
                    iconColor={deletingId === reminder.id ? colors.onSurfaceDisabled : (colors.error || ERROR)} 
                    onPress={() => handleDelete(reminder)}
                    disabled={deletingId === reminder.id}
                  />
                  <Switch 
                    value={!reminder.completed} 
                    color={primary} 
                    onValueChange={(value) => onToggle(reminder, !value)}
                    accessibilityLabel={reminder.completed ? "Mark as incomplete" : "Mark as complete"}
                    accessibilityRole="switch"
                  />
                </View>
              </Card.Content>
            </Card>
          </Animatable.View>
        )}
      />
      <Surface style={[styles.searchDock, { backgroundColor: colors.surface }, isDark && styles.surfaceVariantOnDark]} elevation={4}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.onSurfaceVariant} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search reminders..."
          mode="flat"
          dense
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          style={styles.searchDockInput}
          textColor={colors.onSurface}
          placeholderTextColor={colors.onSurfaceVariant}
          theme={{ colors: { primary, onSurfaceVariant: colors.onSurfaceVariant } }}
          accessibilityLabel="Search reminders"
          accessibilityHint="Type to filter reminders by title or description"
        />
      </Surface>
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: primary }]}
        onPress={onAdd}
        accessibilityLabel="Add new reminder"
        accessibilityRole="button"
      />
    </View>
  );
}

function ScheduleTab({ markedDates, reminders, isDark, palette, onEdit, onRefresh, refreshing, isSmallScreen, isLargeScreen }) {
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
      <ScreenTitle isDark={isDark} action={
        <Pressable style={[styles.titleActionButton, { backgroundColor: colors.primary }]} onPress={() => onEdit(createDraftReminder())}>
          <MaterialCommunityIcons name="plus" size={isSmallScreen ? 18 : 20} color="#FFFFFF" />
        </Pressable>
      }>Schedule</ScreenTitle>
      <ScrollView
        contentContainerStyle={[styles.scheduleContent, isSmallScreen && styles.scheduleContentCompact]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={[
          styles.materialCard, 
          { 
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 2px 8px rgba(0,0,0,0.5)" : "0px 2px 8px rgba(0,0,0,0.08)",
            elevation: 3
          }, 
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Calendar</Text>
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
              textDayFontSize: isSmallScreen ? 12 : 13,
              textMonthFontSize: isSmallScreen ? 14 : 15,
              textDayHeaderFontSize: isSmallScreen ? 11 : 12
            }}
          />
        </View>
        <View style={[
          styles.materialCard, 
          { 
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 2px 8px rgba(0,0,0,0.5)" : "0px 2px 8px rgba(0,0,0,0.08)",
            elevation: 3
          }, 
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>{format(parseISO(selectedDate), DATE_DISPLAY_FORMAT)}</Text>
          {selectedReminders.length ? (
            selectedReminders.map((reminder) => (
              <Swipeable
                key={reminder.id}
                overshootRight={false}
                renderRightActions={() => (
                  <View style={[styles.swipeEditAction, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="pencil" size={24} color="#FFFFFF" />
                  </View>
                )}
                onSwipeableOpen={() => onEdit(reminder)}
              >
                <Pressable style={styles.scheduleRow} onPress={() => onEdit(reminder)}>
                  <VisualCue reminder={reminder} size={48} iconSize={24} compact palette={colors} />
                  <View style={styles.scheduleCopy}>
                    <Text style={[styles.taskTitle, isDark && styles.textOnDark]}>{reminder.title}</Text>
                    <Text style={[styles.taskTime, { color: colors.primary }]}>
                      {format(parseISO(reminder.scheduledAt), "h:mm a")} · {getCountdownLabel(reminder.scheduledAt)}
                    </Text>
                  </View>
                  <Pressable style={styles.editIconButton} onPress={() => onEdit(reminder)}>
                    <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.onSurfaceVariant} />
                  </Pressable>
                </Pressable>
              </Swipeable>
            ))
          ) : (
            <View style={styles.emptySchedule}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={32} color={colors.onSurfaceVariant} />
              <Text style={[styles.emptyText, isDark && styles.mutedOnDark]}>No reminders on this date.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SwipeDeleteAction({ onPress }) {
  return (
    <Pressable style={styles.swipeDeleteAction} onPress={() => {
      console.log("Swipe delete pressed");
      onPress();
    }}>
      <MaterialCommunityIcons name="delete-outline" size={24} color="#FFFFFF" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </Pressable>
  );
}

function ReminderPrompt({ reminder, isDark, palette, onNo, onYes, onSnooze }) {
  const colors = palette || getPalette({}, isDark);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  
  const snoozeOptions = [
    { label: "5 min", minutes: 5 },
    { label: "15 min", minutes: 15 },
    { label: "30 min", minutes: 30 },
    { label: "1 hour", minutes: 60 },
    { label: "2 hours", minutes: 120 }
  ];

  const handleSnooze = (minutes) => {
    const newTime = new Date(new Date().getTime() + minutes * 60000).toISOString();
    onSnooze(newTime);
    setSnoozeMenuOpen(false);
  };

  return (
    <Animatable.View animation="bounceIn" duration={500} style={[styles.reminderScreen, { backgroundColor: colors.background }, isDark && styles.screenDark]} useNativeDriver>
      <ScreenTitle isDark={isDark}>Reminder</ScreenTitle>
      <VisualCue reminder={reminder} size={120} iconSize={56} palette={colors} />
      <View style={styles.reminderCopy}>
        <Text style={[styles.reminderHeadline, { color: colors.primary }]}>It's {format(parseISO(reminder.scheduledAt), "h:mm a")}</Text>
        <Text style={[styles.reminderQuestion, isDark && styles.textOnDark]}>Did you complete {reminder.title}?</Text>
      </View>
      <View style={styles.answerRow}>
        <Pressable style={[styles.answerButton, { backgroundColor: colors.primary }]} onPress={onNo}>
          <MaterialCommunityIcons name="close" size={36} color="#FFFFFF" />
        </Pressable>
        <Pressable style={[styles.answerButton, { backgroundColor: colors.primaryContainer }]} onPress={onYes}>
          <MaterialCommunityIcons name="check" size={36} color={colors.primary} />
        </Pressable>
      </View>
      {onSnooze && (
        <View style={styles.snoozeSection}>
          <Pressable style={[styles.snoozeButton, { backgroundColor: colors.surfaceVariant }]} onPress={() => setSnoozeMenuOpen(!snoozeMenuOpen)}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.snoozeButtonText, isDark && styles.textOnDark]}>Snooze</Text>
            <MaterialCommunityIcons name={snoozeMenuOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.onSurfaceVariant} />
          </Pressable>
          {snoozeMenuOpen && (
            <View style={[styles.snoozeMenu, { backgroundColor: colors.surface }]}>
              {snoozeOptions.map((option) => (
                <Pressable key={option.minutes} style={styles.snoozeOption} onPress={() => handleSnooze(option.minutes)}>
                  <Text style={[styles.snoozeOptionText, isDark && styles.textOnDark]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </Animatable.View>
  );
}

function TaskEditScreen({ reminder, mode, isDark, palette, onUpdate, onAttachImage, onSave, onCancel, onDelete, saving, deleting }) {
  const colors = palette || getPalette({}, isDark);
  const [timeOpen, setTimeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [repeatUntilOpen, setRepeatUntilOpen] = useState(false);
  const currentScheduled = isValid(parseISO(reminder.scheduledAt)) ? parseISO(reminder.scheduledAt) : new Date();
  const timePickerValue = reminder.timeSet === false ? new Date() : currentScheduled;
  const datePickerValue = reminder.hasDate === false ? new Date() : currentScheduled;
  const repeatUntilValue = reminder.repeatUntil && isValid(parseISO(reminder.repeatUntil)) ? parseISO(reminder.repeatUntil) : currentScheduled;
  const openTimePicker = () => {
    console.log("openTimePicker called, platform:", Platform.OS);
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
    console.log("openDatePicker called, platform:", Platform.OS);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: datePickerValue,
        mode: "date",
        display: "default",
        positiveButton: { label: "OK", textColor: colors.primary },
        negativeButton: { label: "Cancel", textColor: colors.onSurfaceVariant },
        neutralButton: { label: "Clear", textColor: colors.onSurfaceVariant },
        onChange: (event, selectedDate) => {
          console.log("DatePicker onChange:", event.type, selectedDate);
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
    console.log("openRingtonePicker called");
    Alert.alert(
      "Reminder sound",
      "Choose the sound used by the full-screen alarm.",
      RINGTONE_OPTIONS.map(([value, label]) => ({
        text: label,
        onPress: () => {
          console.log("Ringtone selected:", value);
          onUpdate({ ringtone: value });
        }
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
    console.log("openFollowUpCountPicker called");
    Alert.alert(
      "Follow-up reminders",
      "How many extra reminders should fire after the first alert?",
      FOLLOW_UP_COUNTS.map((count) => ({
        text: count === 0 ? "Off" : `${count} time${count > 1 ? "s" : ""}`,
        onPress: () => {
          console.log("Follow-up count selected:", count);
          onUpdate({ followUpEnabled: count > 0, followUpCount: count });
        }
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };
  const openFollowUpIntervalPicker = () => {
    console.log("openFollowUpIntervalPicker called");
    Alert.alert(
      "Follow-up interval",
      "How long should VizMinder wait between follow-up reminders?",
      FOLLOW_UP_INTERVALS.map((minutes) => ({
        text: `${minutes} minute${minutes > 1 ? "s" : ""}`,
        onPress: () => {
          console.log("Follow-up interval selected:", minutes);
          onUpdate({ followUpIntervalMinutes: minutes });
        }
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };
  const ringtoneLabel = RINGTONE_OPTIONS.find(([value]) => value === reminder.ringtone)?.[1] || "System alarm";
  return (
    <Animatable.View animation="fadeInUp" duration={300} style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]} useNativeDriver>
      <ScreenTitle isDark={isDark}>{mode === "add" ? "New Reminder" : "Edit Reminder"}</ScreenTitle>
      <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.imageEditWrap}>
          <VisualCue reminder={reminder} size={112} iconSize={52} palette={colors} />
          <Pressable style={[styles.editFab, { backgroundColor: colors.primary }]} onPress={onAttachImage}>
            <MaterialCommunityIcons name="pencil" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <VisualSourcePicker reminder={reminder} isDark={isDark} palette={colors} onUpdate={onUpdate} onAttachImage={onAttachImage} />

        <EditTextField isDark={isDark} palette={colors} label="Title" value={reminder.title} onChangeText={(title) => onUpdate({ title })} />
        <EditTextField
          isDark={isDark}
          palette={colors}
          label="Description"
          value={reminder.description}
          onChangeText={(description) => onUpdate({ description })}
          multiline
        />
        
        <View style={[styles.dateTimeSection, { backgroundColor: colors.surface, borderColor: colors.outline }, isDark && styles.cardOnDark]}>
          <Text style={[styles.editLabel, isDark && styles.textOnDark]}>Schedule</Text>
          <View style={styles.dateTimeRow}>
            <Pressable 
              style={[styles.dateTimeButton, { backgroundColor: colors.surfaceVariant }]} 
              onPress={() => {
                console.log("Date button pressed");
                openDatePicker();
              }}
            >
              <MaterialCommunityIcons name="calendar-range" size={20} color={colors.primary} />
              <Text style={[styles.dateTimeButtonText, { color: colors.onSurface }]}>
                {reminder.hasDate === false ? "Select Date" : format(parseISO(reminder.scheduledAt), "MMM dd, yyyy")}
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.dateTimeButton, { backgroundColor: colors.surfaceVariant }]} 
              onPress={() => {
                console.log("Time button pressed");
                openTimePicker();
              }}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary} />
              <Text style={[styles.dateTimeButtonText, { color: colors.onSurface }]}>
                {reminder.timeSet === false ? "Select Time" : format(parseISO(reminder.scheduledAt), "HH:mm")}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.dateTimeHint, isDark && styles.mutedOnDark]}>
            {reminder.hasDate && reminder.timeSet 
              ? `Scheduled for ${format(parseISO(reminder.scheduledAt), "MMM dd, yyyy 'at' HH:mm")}`
              : "Select both date and time for your reminder"}
          </Text>
        </View>
        <EditField
          isDark={isDark}
          palette={colors}
          label="Sound"
          value={ringtoneLabel}
          onPress={openRingtonePicker}
        />
        <View style={[
          styles.importantRow, 
          { 
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          }, 
          isDark && styles.cardOnDark
        ]}>
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
        <View style={[
          styles.importantRow, 
          { 
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          }, 
          isDark && styles.cardOnDark
        ]}>
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
        <View style={[
          styles.importantRow, 
          { 
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          }, 
          isDark && styles.cardOnDark
        ]}>
          <View>
            <Text style={[styles.editLabel, isDark && styles.textOnDark]}>Important reminder</Text>
            <Text style={[styles.importantHelp, isDark && styles.mutedOnDark]}>Yes triggers celebration when completed.</Text>
          </View>
          <Switch value={Boolean(reminder.important)} color={colors.primary} onValueChange={(important) => onUpdate({ important })} />
        </View>
        <EditField
          isDark={isDark}
          palette={colors}
          label="Priority"
          value={reminder.priority || "medium"}
          onPress={() => {
            const priorities = ["high", "medium", "low"];
            const currentIndex = priorities.indexOf(reminder.priority || "medium");
            const nextIndex = (currentIndex + 1) % priorities.length;
            onUpdate({ priority: priorities[nextIndex] });
          }}
        />
        <View style={styles.formActions}>
          {onDelete ? (
            <Button 
              mode="text" 
              icon={deleting ? undefined : "delete-outline"} 
              textColor={ERROR} 
              style={styles.deleteButton} 
              onPress={onDelete}
              loading={deleting}
              disabled={deleting || saving}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
          <Button 
            mode="contained" 
            buttonColor={colors.primary} 
            textColor={colors.onPrimary} 
            style={styles.actionButton} 
            onPress={onSave}
            loading={saving}
            icon={saving ? undefined : "content-save"}
            disabled={saving || deleting}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button mode="outlined" textColor={colors.onSurfaceVariant} style={styles.actionButton} onPress={onCancel} disabled={saving || deleting}>
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
            console.log("Web TimePicker onChange:", event.type, selectedDate);
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
            console.log("Web DatePicker onChange:", event.type, selectedDate);
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

function StatsTab({ reminders, completedCount, isDark, palette, isSmallScreen, isLargeScreen }) {
  const colors = palette || getPalette({}, isDark);
  const totalReminders = reminders.length;
  const completionRate = totalReminders > 0 ? Math.round((completedCount / totalReminders) * 100) : 0;
  const importantReminders = reminders.filter(r => r.important).length;
  const completedImportant = reminders.filter(r => r.important && r.completed).length;
  const todayReminders = reminders.filter(r => {
    const today = format(new Date(), "yyyy-MM-dd");
    return format(parseISO(r.scheduledAt), "yyyy-MM-dd") === today;
  }).length;
  const streak = reminders.reduce((max, r) => Math.max(max, r.streak || 0), 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Stats</ScreenTitle>
      <ScrollView contentContainerStyle={[styles.statsContent, isSmallScreen && styles.statsContentCompact]} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard} elevation={3} mode="elevated">
          <Card.Content>
            <Text style={[styles.statsTitle, isDark && styles.textOnDark]}>Completion Rate</Text>
            <View style={styles.statsValueContainer}>
              <Text style={[styles.statsValue, { color: colors.primary }]}>{completionRate}%</Text>
              <Text style={[styles.statsLabel, isDark && styles.mutedOnDark]}>{completedCount} of {totalReminders} completed</Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
              <View style={[styles.progressFill, { width: `${completionRate}%`, backgroundColor: colors.primary }]} />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard} elevation={3} mode="elevated">
          <Card.Content>
            <Text style={[styles.statsTitle, isDark && styles.textOnDark]}>Important Reminders</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{importantReminders}</Text>
                <Text style={[styles.statLabel, isDark && styles.mutedOnDark]}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.success || SUCCESS }]}>{completedImportant}</Text>
                <Text style={[styles.statLabel, isDark && styles.mutedOnDark]}>Completed</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard} elevation={3} mode="elevated">
          <Card.Content>
            <Text style={[styles.statsTitle, isDark && styles.textOnDark]}>Today's Reminders</Text>
            <View style={styles.statsValueContainer}>
              <Text style={[styles.statsValue, { color: colors.primary }]}>{todayReminders}</Text>
              <Text style={[styles.statsLabel, isDark && styles.mutedOnDark]}>Reminders scheduled for today</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard} elevation={3} mode="elevated">
          <Card.Content>
            <Text style={[styles.statsTitle, isDark && styles.textOnDark]}>Best Streak</Text>
            <View style={styles.statsValueContainer}>
              <Text style={[styles.statsValue, { color: colors.warning || "#FF9500" }]}>{streak}</Text>
              <Text style={[styles.statsLabel, isDark && styles.mutedOnDark]}>Consecutive days completed</Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

function AccountTab({ reminders, authUser, completedCount, isDark, palette, onSyncNow, onMessage, isSmallScreen, isLargeScreen, settings, onUpdateSettings, onReset }) {
  const colors = palette || getPalette({}, isDark);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [syncRows, setSyncRows] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncError, setSyncError] = useState("");
  const [settingsPage, setSettingsPage] = useState("main");

  const signedIn = authUser && !authUser.isAnonymous && authUser.uid !== "offline-user";
  const accountLabel = signedIn ? authUser.email || "Email account" : authUser?.isAnonymous ? "Anonymous session" : "Not signed in";

  useEffect(() => {
    if (Platform.OS !== "android" || settingsPage === "main") {
      return undefined;
    }
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSettingsPage("main");
      return true;
    });
    return () => backSubscription.remove();
  }, [settingsPage]);

  if (settingsPage === "theme") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
        <ScreenTitle isDark={isDark}>Theme</ScreenTitle>
        <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backRow} onPress={() => setSettingsPage("main")}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Account</Text>
          </Pressable>
          <View style={[
            styles.settingsPanel,
            {
              backgroundColor: colors.surface,
              boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
              elevation: 2
            },
            isDark && styles.materialCardDark
          ]}>
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
      </View>
    );
  }

  if (settingsPage === "advanced") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
        <ScreenTitle isDark={isDark}>Advanced</ScreenTitle>
        <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backRow} onPress={() => setSettingsPage("main")}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Account</Text>
          </Pressable>
          <View style={[
            styles.settingsPanel,
            {
              backgroundColor: colors.surface,
              boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
              elevation: 2
            },
            isDark && styles.materialCardDark
          ]}>
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
            <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
              The installed Android APK uses native AlarmManager and a lock-screen Activity for full-screen visual reminders. Android may still require notification and exact alarm permission.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (settingsPage === "notification") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
        <ScreenTitle isDark={isDark}>Notification</ScreenTitle>
        <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backRow} onPress={() => setSettingsPage("main")}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Account</Text>
          </Pressable>
          <View style={[
            styles.settingsPanel,
            {
              backgroundColor: colors.surface,
              boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
              elevation: 2
            },
            isDark && styles.materialCardDark
          ]}>
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
      </View>
    );
  }

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
      <Card style={styles.accountCard} elevation={3} mode="elevated">
        <Card.Content style={styles.accountCardContent}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="account" size={isSmallScreen ? 36 : 40} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.accountName, isDark && styles.textOnDark]}>User</Text>
            <Text style={[styles.accountPlan, isDark && styles.textOnDark]}>{accountLabel}</Text>
          </View>
        </Card.Content>
      </Card>
      <ScrollView contentContainerStyle={[styles.accountContent, isSmallScreen && styles.accountContentCompact]} showsVerticalScrollIndicator={false}>
        {!signedIn ? (
          <Card style={styles.planBlock} elevation={2} mode="elevated">
            <Card.Content>
              <Text style={[styles.planTitle, isDark && styles.textOnDark]}>Sign In</Text>
              <TextInput value={email} onChangeText={setEmail} label="Email" autoCapitalize="none" keyboardType="email-address" style={styles.authInput} textColor={colors.onSurface} />
              <TextInput value={password} onChangeText={setPassword} label="Password" secureTextEntry style={styles.authInput} textColor={colors.onSurface} />
              <Text style={[styles.planCopy, isDark && styles.mutedOnDark]}>Password requires at least 8 characters, 2 letters, and 6 numbers.</Text>
              {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
              <View style={styles.planActions}>
                <Button mode="outlined" textColor={colors.primary} style={styles.planButton} onPress={() => submitEmailAuth("login")}>Sign In</Button>
                <Button mode="contained" buttonColor={colors.primary} style={styles.planButton} onPress={() => submitEmailAuth("register")}>Create Account</Button>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.planBlock} elevation={2} mode="elevated">
            <Card.Content>
              <Text style={[styles.planTitle, isDark && styles.textOnDark]}>Signed In</Text>
              <Text style={[styles.planCopy, isDark && styles.mutedOnDark]}>{accountLabel}</Text>
              {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
              <Button mode="outlined" textColor={colors.primary} onPress={() => signOutUser().catch((error) => setSyncError(error.message))}>Sign Out</Button>
            </Card.Content>
          </Card>
        )}

        {signedIn ? (
        <Card style={styles.planBlock} elevation={2} mode="elevated">
          <Card.Content>
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
          </Card.Content>
        </Card>
        ) : null}

        <View style={[styles.sectionDivider, { backgroundColor: colors.outline }]} />

        <Card style={styles.planBlock} elevation={2} mode="elevated">
          <Card.Content>
            <Text style={[styles.planTitle, isDark && styles.textOnDark]}>Settings</Text>
            <View style={styles.settingsList}>
              {[
                ["palette", "Theme", "Light, dark, and Material color options.", () => setSettingsPage("theme")],
                ["cog", "Advanced", "Debug controls and native alarm notes.", () => setSettingsPage("advanced")],
                ["bell-ring", "Notification", "Notification permissions, alert sound, and system settings.", () => setSettingsPage("notification")],
                ["alert-circle", "Reset Reminders", "Clear all reminders on this device.", onReset]
              ].map(([icon, title, copy, action]) => (
                <View key={title}>
                  <Pressable android_ripple={{ color: colors.surfaceVariant }} style={styles.settingsRow} onPress={action}>
                    <MaterialCommunityIcons name={icon} size={24} color={colors.onSurfaceVariant} />
                    <View style={styles.settingsCopy}>
                      <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>{title}</Text>
                      <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>{copy}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
                  </Pressable>
                  <Divider style={styles.settingsDivider} />
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

function SettingsTab({ settings, onUpdateSettings, isDark, palette, onReset, onMessage, isSmallScreen, isLargeScreen }) {
  const colors = palette || getPalette({}, isDark);
  const [settingsPage, setSettingsPage] = useState("main");
  useEffect(() => {
    if (Platform.OS !== "android" || settingsPage === "main") {
      return undefined;
    }
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSettingsPage("main");
      return true;
    });
    return () => backSubscription.remove();
  }, [settingsPage]);
  const items = [
    ["palette-outline", "Theme", "Light, dark, and Material color options.", () => setSettingsPage("theme")],
    ["tune-vertical", "Advanced", "Debug controls and native alarm notes.", () => setSettingsPage("advanced")],
    ["message-outline", "Notification", "Notification permissions, alert sound, and system settings.", () => setSettingsPage("notification")],
    ["restart", "Reset Reminders", "Clear all reminders on this device.", onReset]
  ];

  if (settingsPage === "theme") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
        <ScreenTitle isDark={isDark}>Theme</ScreenTitle>
        <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backRow} onPress={() => setSettingsPage("main")}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[
            styles.settingsPanel, 
            { 
              backgroundColor: colors.surface,
              boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
              elevation: 2
            }, 
            isDark && styles.materialCardDark
          ]}>
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
      </View>
    );
  }

  if (settingsPage === "advanced") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
        <ScreenTitle isDark={isDark}>Advanced</ScreenTitle>
        <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backRow} onPress={() => setSettingsPage("main")}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[
            styles.settingsPanel, 
            { 
              backgroundColor: colors.surface,
              boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
              elevation: 2
            }, 
            isDark && styles.materialCardDark
          ]}>
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
            <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
              The installed Android APK uses native AlarmManager and a lock-screen Activity for full-screen visual reminders. Android may still require notification and exact alarm permission.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (settingsPage === "notification") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
        <ScreenTitle isDark={isDark}>Notification</ScreenTitle>
        <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backRow} onPress={() => setSettingsPage("main")}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Settings</Text>
          </Pressable>
          <View style={[
            styles.settingsPanel, 
            { 
              backgroundColor: colors.surface,
              boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
              elevation: 2
            }, 
            isDark && styles.materialCardDark
          ]}>
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
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Settings</ScreenTitle>
      <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
        <View style={[
          styles.settingsList, 
          { 
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          }, 
          isDark && styles.materialCardDark
        ]}>
          {items.map(([icon, title, copy, action]) => (
            <View key={title}>
              <Pressable android_ripple={{ color: colors.surfaceVariant }} style={styles.settingsRow} onPress={action}>
                <MaterialCommunityIcons name={icon} size={24} color={colors.onSurfaceVariant} />
                <View style={styles.settingsCopy}>
                  <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>{title}</Text>
                  <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>{copy}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
              <Divider style={styles.settingsDivider} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
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

function DeviceTab({ batteryInfo, networkState, currentLocation, biometricAvailable, torchAvailable, showMap, setShowMap, reminders, isDark, palette, onMessage, onRefreshBattery, onRefreshNetwork, onRefreshLocation, isSmallScreen, isLargeScreen }) {
  const colors = palette || getPalette({}, isDark);
  const [torchOn, setTorchOn] = useState(false);
  const [accelData, setAccelData] = useState(null);
  const [gyroData, setGyroData] = useState(null);
  const [readingSensor, setReadingSensor] = useState(false);

  const readAccelerometer = async () => {
    setReadingSensor(true);
    try {
      const data = await getAccelerometerData();
      if (data) {
        setAccelData(data);
        onMessage("Accelerometer read");
      } else {
        onMessage("Accelerometer not available on this device");
      }
    } catch (error) {
      onMessage("Failed to read accelerometer");
    } finally {
      setReadingSensor(false);
    }
  };

  const readGyroscope = async () => {
    setReadingSensor(true);
    try {
      const data = await getGyroscopeData();
      if (data) {
        setGyroData(data);
        onMessage("Gyroscope read");
      } else {
        onMessage("Gyroscope not available on this device");
      }
    } catch (error) {
      onMessage("Failed to read gyroscope");
    } finally {
      setReadingSensor(false);
    }
  };

  const formatAxis = (data) => {
    if (!data) return "Tap 'Read' to sample";
    const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : "?");
    return `x: ${fmt(data.x)}  y: ${fmt(data.y)}  z: ${fmt(data.z)}`;
  };

  const networkTypeLabel = (() => {
    if (!networkState) return "Unknown";
    if (!networkState.isConnected) return "Offline";
    const t = (networkState.type || "").toString().toLowerCase();
    if (t === "cellular" || t.includes("g") || t === "2g" || t === "3g" || t === "4g" || t === "5g") return "Cellular";
    if (t === "wifi") return "WiFi";
    if (t === "ethernet" || t === "bluetooth" || t === "wimax" || t === "vpn" || t === "other") {
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    if (t === "web") return "Web";
    return "Connected";
  })();

  const handleTorchToggle = async () => {
    try {
      const newState = await toggleTorch();
      setTorchOn(newState);
      onMessage(newState ? "Torch turned on" : "Torch turned off");
    } catch (error) {
      onMessage("Failed to toggle torch");
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await authenticateBiometric("Authenticate to access device features");
      if (result.success) {
        onMessage("Biometric authentication successful");
      } else {
        onMessage("Biometric authentication failed");
      }
    } catch (error) {
      onMessage("Biometric authentication error");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Device Features</ScreenTitle>
      <ScrollView contentContainerStyle={[styles.settingsContent, isSmallScreen && styles.settingsContentCompact]} showsVerticalScrollIndicator={false}>
        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Battery</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name="battery-charging" size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>
                {batteryInfo && batteryInfo.level != null ? `${Math.round(batteryInfo.level)}%` : "Unknown"}
              </Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                {batteryInfo?.isCharging ? "Charging" : "Not charging"}
                {batteryInfo?.isLow ? " - Low battery" : ""}
              </Text>
            </View>
          </View>
          {onRefreshBattery ? (
            <Button mode="outlined" onPress={onRefreshBattery} style={styles.deviceButton} icon="refresh">Refresh</Button>
          ) : null}
        </View>

        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Network</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name={networkState?.isConnected ? "wifi" : "wifi-off"} size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>
                {networkState?.isConnected ? "Connected" : "Offline"}
              </Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                {networkTypeLabel}
              </Text>
            </View>
          </View>
          {onRefreshNetwork ? (
            <Button mode="outlined" onPress={onRefreshNetwork} style={styles.deviceButton} icon="refresh">Refresh</Button>
          ) : null}
        </View>

        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Location</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name="map-marker" size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>
                {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : "Not available"}
              </Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                GPS coordinates
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {onRefreshLocation ? (
              <Button mode="outlined" onPress={onRefreshLocation} style={[styles.mapButton, { flex: 1, minWidth: 120 }]} icon="crosshairs-gps">Refresh</Button>
            ) : null}
            <Button
              mode="outlined"
              onPress={() => setShowMap(!showMap)}
              style={[styles.mapButton, { flex: 1, minWidth: 120 }]}
              icon="map"
            >
              {showMap ? "Hide Map" : "Show Map"}
            </Button>
          </View>
          {showMap && currentLocation && (
            <View style={styles.mapContainer}>
              <LocationMap
                location={currentLocation}
                reminders={reminders}
                style={styles.map}
              />
            </View>
          )}
        </View>

        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Biometrics</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name={biometricAvailable ? "fingerprint" : "fingerprint-off"} size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>
                {biometricAvailable ? "Available" : "Not available"}
              </Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                Fingerprint or Face ID
              </Text>
            </View>
          </View>
          {biometricAvailable && (
            <Button
              mode="outlined"
              onPress={handleBiometricAuth}
              style={styles.deviceButton}
              icon="fingerprint"
            >
              Test Biometric
            </Button>
          )}
        </View>

        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Torch</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name={torchAvailable ? "flashlight" : "flashlight-off"} size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>
                {torchAvailable ? "Available" : "Not available"}
              </Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                {torchOn ? "On" : "Off"}
              </Text>
            </View>
          </View>
          {torchAvailable && (
            <Button
              mode="outlined"
              onPress={handleTorchToggle}
              style={styles.deviceButton}
              icon={torchOn ? "flashlight-off" : "flashlight"}
            >
              {torchOn ? "Turn Off" : "Turn On"}
            </Button>
          )}
        </View>

        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Sensors</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name="motion-sensor" size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Accelerometer</Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>{formatAxis(accelData)}</Text>
            </View>
          </View>
          <Button mode="outlined" onPress={readAccelerometer} loading={readingSensor} disabled={readingSensor} style={styles.deviceButton} icon="play">Read accelerometer</Button>
          <View style={[styles.deviceInfoRow, { marginTop: 8 }]}>
            <MaterialCommunityIcons name="rotate-3d" size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Gyroscope</Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>{formatAxis(gyroData)}</Text>
            </View>
          </View>
          <Button mode="outlined" onPress={readGyroscope} loading={readingSensor} disabled={readingSensor} style={styles.deviceButton} icon="play">Read gyroscope</Button>
        </View>

        <View style={[
          styles.settingsPanel,
          {
            backgroundColor: colors.surface,
            boxShadow: isDark ? "0px 1px 4px rgba(0,0,0,0.4)" : "0px 1px 4px rgba(0,0,0,0.05)",
            elevation: 2
          },
          isDark && styles.materialCardDark
        ]}>
          <Text style={[styles.sectionTitle, isDark && styles.textOnDark]}>Security</Text>
          <View style={styles.deviceInfoRow}>
            <MaterialCommunityIcons name="lock" size={24} color={colors.primary} />
            <View style={styles.deviceInfoText}>
              <Text style={[styles.settingsTitle, isDark && styles.textOnDark]}>Data Encryption</Text>
              <Text style={[styles.settingsDescription, isDark && styles.mutedOnDark]}>
                AES encryption enabled for sensitive data
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function BottomNav({ active, isDark, palette, onChange }) {
  const colors = palette || getPalette({}, isDark);
  const tabs = [
    ["home", "bell-ring", "Reminders"],
    ["schedule", "calendar-clock", "Schedule"],
    ["stats", "chart-box", "Stats"],
    ["account", "account-circle", "Account"],
    ["device", "devices", "Device"]
  ];

  return (
    <View style={[
      styles.bottomNav, 
      { 
        backgroundColor: colors.surface, 
        borderTopColor: colors.outline,
        boxShadow: isDark ? "0px -2px 8px rgba(0,0,0,0.5)" : "0px -2px 8px rgba(0,0,0,0.08)",
        elevation: 4
      }, 
      isDark && styles.bottomNavDark
    ]}>
      {tabs.map(([key, icon, label]) => (
        <Pressable key={key} style={styles.navItem} onPress={() => onChange(key)}>
          <View style={[styles.navIconWrap, active === key && { backgroundColor: colors.primaryContainer, borderRadius: 24 }]}>
            <View style={styles.navIconAnchor}>
              <MaterialCommunityIcons name={icon} size={24} color={active === key ? colors.primary : colors.onSurfaceVariant} />
              {key === "home" ? <View style={styles.notificationDot} /> : null}
            </View>
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.navLabel, { color: active === key ? colors.primary : colors.onSurfaceVariant }]}
          >{label}</Text>
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
  if (!Notifications) {
    return false;
  }
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
  if (!Notifications) {
    return null;
  }
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
    paddingTop: 22,
    paddingHorizontal: 16
  },
  screenTitle: {
    color: TEXT,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
    maxWidth: "70%",
    textAlign: "center"
  },
  titleAction: {
    position: "absolute",
    right: 16,
    top: 10
  },
  titleActionRow: {
    flexDirection: "row",
    gap: 8
  },
  titleActionButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    width: 36
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
    flexShrink: 1,
    minWidth: 0,
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
    paddingBottom: 100,
    paddingTop: 8
  },
  homeListCompact: {
    paddingBottom: 80,
    paddingTop: 4
  },
  emptyHome: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 80
  },
  emptyVisual: {
    alignItems: "center",
    backgroundColor: LIGHT_PURPLE,
    borderRadius: 50,
    height: 120,
    justifyContent: "center",
    width: 120
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 8
  },
  emptyText: {
    color: MUTED,
    fontSize: 16,
    textAlign: "center"
  },
  emptySubtext: {
    color: MUTED,
    fontSize: 14,
    marginTop: 4,
    opacity: 0.7,
    textAlign: "center"
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
  scheduleContentCompact: {
    padding: 12,
    paddingBottom: 80
  },
  statsContent: {
    padding: 16,
    paddingBottom: 96
  },
  statsContentCompact: {
    padding: 12,
    paddingBottom: 80
  },
  statsCard: {
    borderRadius: 20,
    marginBottom: 16,
    padding: 20
  },
  statsTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16
  },
  statsValueContainer: {
    alignItems: "center",
    marginBottom: 12
  },
  statsValue: {
    fontSize: 48,
    fontWeight: "700"
  },
  statsLabel: {
    color: MUTED,
    fontSize: 14,
    marginTop: 4
  },
  progressBar: {
    borderRadius: 8,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    borderRadius: 8,
    height: "100%"
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around"
  },
  statItem: {
    alignItems: "center"
  },
  statNumber: {
    fontSize: 36,
    fontWeight: "700"
  },
  statLabel: {
    color: MUTED,
    fontSize: 13,
    marginTop: 4
  },
  scheduleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10
  },
  scheduleCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0
  },
  emptySchedule: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 22
  },
  emptyText: {
    color: MUTED,
    fontSize: 14
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
  swipeEditAction: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginRight: 14,
    marginVertical: 6,
    paddingHorizontal: 18,
    width: 80
  },
  swipeDeleteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  taskRow: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 16,
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 8,
    minHeight: 72,
    overflow: "visible",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  taskRowCompact: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  visualBubble: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    overflow: "visible",
    width: 48
  },
  taskCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 12
  },
  taskHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  taskBadges: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  categoryBadge: {
    borderRadius: 12,
    height: 20,
    justifyContent: "center",
    width: 20
  },
  categoryBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  taskTime: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 2
  },
  taskTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    letterSpacing: -0.2
  },
  taskDescription: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2
  },
  taskActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  taskMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  priorityChip: {
    height: 24,
    marginLeft: 8
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600"
  },
  searchIcon: {
    marginLeft: 12
  },
  fab: {
    position: "absolute",
    bottom: 90,
    right: 16,
    borderRadius: 16
  },
  accountCardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  testButton: {
    alignItems: "center",
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  editIconButton: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  deleteIconButton: {
    alignItems: "center",
    backgroundColor: SURFACE_VARIANT,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  searchDock: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 20,
    bottom: 80,
    flexDirection: "row",
    height: 52,
    justifyContent: "space-between",
    left: 16,
    paddingLeft: 16,
    paddingRight: 8,
    position: "absolute",
    right: 16,
    boxShadow: "0px 4px 12px rgba(0,0,0,0.12)",
    elevation: 4
  },
  searchDockInput: {
    backgroundColor: "transparent",
    flex: 1,
    height: 44,
    marginHorizontal: 8,
    paddingHorizontal: 0
  },
  addButton: {
    alignItems: "center",
    backgroundColor: PURPLE,
    borderRadius: 16,
    height: 40,
    justifyContent: "center",
    width: 44
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
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 26,
    paddingHorizontal: 12,
    textAlign: "center"
  },
  reminderQuestion: {
    color: PURPLE,
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 12,
    textAlign: "center"
  },
  answerRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginBottom: 24
  },
  answerButton: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: "center",
    maxHeight: 104,
    maxWidth: 104,
    minHeight: 80,
    minWidth: 80,
    width: "32%"
  },
  snoozeSection: {
    marginTop: 16
  },
  snoozeButton: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    padding: 12
  },
  snoozeButtonText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "500"
  },
  snoozeMenu: {
    borderRadius: 12,
    marginTop: 8,
    overflow: "hidden"
  },
  snoozeOption: {
    alignItems: "center",
    padding: 16
  },
  snoozeOptionText: {
    color: TEXT,
    fontSize: 16
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
  dateTimeSection: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: "100%"
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent"
  },
  dateTimeButtonText: {
    fontSize: 15,
    fontWeight: "600"
  },
  dateTimeHint: {
    fontSize: 14,
    marginTop: 12,
    fontStyle: "italic",
    fontWeight: "500"
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
  accountContentCompact: {
    gap: 12,
    paddingBottom: 96
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
  settingsContentCompact: {
    paddingBottom: 88
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
    flex: 1,
    flexShrink: 1,
    minWidth: 0
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
  sectionDivider: {
    height: 8,
    marginVertical: 16
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 1000
  },
  successIcon: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  successText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    textShadow: "0px 2px 4px rgba(0,0,0,0.3)"
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderTopColor: LINE,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    height: 66,
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: 4,
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
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 2
  },
  navIconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 32,
    justifyContent: "center",
    maxWidth: "100%",
    paddingHorizontal: 8
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
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: "100%"
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
    maxWidth: 420,
    padding: 18,
    width: "90%"
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
    justifyContent: "center",
    flexWrap: "wrap"
  },
  timeInput: {
    backgroundColor: "#E9DFFF",
    fontSize: 28,
    height: 58,
    textAlign: "center",
    width: 88,
    maxWidth: "40%"
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
    maxWidth: 460,
    paddingTop: 18,
    paddingBottom: 14,
    width: "92%"
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
  },
  deviceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  deviceInfoText: {
    flex: 1
  },
  mapButton: {
    marginTop: 12
  },
  mapContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    height: 200
  },
  map: {
    width: "100%",
    height: "100%"
  },
  deviceButton: {
    marginTop: 12
  },
  bannerAd: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0
  },
  notificationContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000
  },
  notificationText: {
    color: "#FFFFFF",
    fontWeight: "500"
  }
});

