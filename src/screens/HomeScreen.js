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
    error: themeColors.error || ERROR,
    success: themeColors.success || SUCCESS,
    warning: themeColors.warning || "#FF9500"
  };
}

function createDraftReminder() {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}`,
    title: "",
    description: "",
    visualCue: "Photo or icon cue",
    visualType: "image",
    icon: null,
    emoji: null,
    scheduledAt: now,
    createdAt: now,
    timeSet: false,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [imagePickerDialogOpen, setImagePickerDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState(null);
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
    setReminderToDelete({ reminder, afterDelete });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = () => {
    if (reminderToDelete) {
      console.log("Delete confirmed for:", reminderToDelete.reminder.id);
      setDeleting(true);
      deleteReminderWithUndo(reminderToDelete.reminder, reminderToDelete.afterDelete);
      setTimeout(() => {
        isDeletingRef.current = false;
      }, 500);
    }
    setDeleteDialogOpen(false);
    setReminderToDelete(null);
  };

  const confirmResetReminders = () => {
    setResetDialogOpen(true);
  };

  const handleResetConfirmed = async () => {
    if (Notifications) {
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }
    await Promise.all(reminders.map((reminder) => cancelNativeAlarm(reminder.id).catch(() => false)));
    resetPrototype();
    setUndoDelete(null);
    setMessage("Reminder data reset.");
    setResetDialogOpen(false);
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
    <>
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
            onAttachImage={() => setImagePickerDialogOpen(true)}
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
                    setEditing({ 
                      ...reminder, 
                      timeSet: reminder.timeSet !== undefined ? reminder.timeSet : true,
                      hasDate: reminder.hasDate !== undefined ? reminder.hasDate : false
                    });
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
                    setEditing({ 
                      ...reminder, 
                      timeSet: reminder.timeSet !== undefined ? reminder.timeSet : true,
                      hasDate: reminder.hasDate !== undefined ? reminder.hasDate : false
                    });
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
              ) : tab === "settings" ? (
                <SettingsTab
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  isDark={isDark}
                  palette={palette}
                  onReset={confirmResetReminders}
                  onMessage={setMessage}
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
    
    {/* Delete confirmation dialog */}
    <Portal>
      <Dialog visible={deleteDialogOpen} onDismiss={() => { setDeleteDialogOpen(false); setReminderToDelete(null); isDeletingRef.current = false; }} style={{ backgroundColor: palette.surface }}>
        <Dialog.Title style={{ color: palette.onSurface }}>Delete Reminder?</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: palette.onSurfaceVariant }}>This removes the reminder and cancels its scheduled alarm.</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => { setDeleteDialogOpen(false); setReminderToDelete(null); isDeletingRef.current = false; }} textColor={palette.primary}>Cancel</Button>
          <Button onPress={handleDeleteConfirmed} textColor={palette.error}>Delete</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>

    {/* Reset confirmation dialog */}
    <Portal>
      <Dialog visible={resetDialogOpen} onDismiss={() => setResetDialogOpen(false)} style={{ backgroundColor: palette.surface }}>
        <Dialog.Title style={{ color: palette.onSurface }}>Reset All Reminders?</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: palette.onSurfaceVariant }}>This deletes every reminder on this device and cancels scheduled alerts. This action cannot be undone.</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setResetDialogOpen(false)} textColor={palette.primary}>Cancel</Button>
          <Button onPress={handleResetConfirmed} textColor={palette.error}>Reset</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>

    {/* Image picker dialog */}
    <Portal>
      <Dialog visible={imagePickerDialogOpen} onDismiss={() => setImagePickerDialogOpen(false)} style={{ backgroundColor: palette.surface }}>
        <Dialog.Title style={{ color: palette.onSurface }}>Photo Visual Cue</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: palette.onSurfaceVariant, marginBottom: 12 }}>Choose how to attach an image.</Text>
          <Pressable
            style={[styles.visualOptionButton, { backgroundColor: palette.surfaceVariant }]}
            onPress={async () => {
              const imageUri = await pickImage("library");
              if (imageUri) setEditing((current) => ({ ...current, imageUri, visualType: "image" }));
              setImagePickerDialogOpen(false);
            }}
          >
            <MaterialCommunityIcons name="image" size={24} color={palette.primary} />
            <Text style={[styles.visualOptionText, { color: palette.onSurface }]}>Choose from phone</Text>
          </Pressable>
          <Pressable
            style={[styles.visualOptionButton, { backgroundColor: palette.surfaceVariant }]}
            onPress={async () => {
              const imageUri = await pickImage("camera");
              if (imageUri) setEditing((current) => ({ ...current, imageUri, visualType: "image" }));
              setImagePickerDialogOpen(false);
            }}
          >
            <MaterialCommunityIcons name="camera" size={24} color={palette.primary} />
            <Text style={[styles.visualOptionText, { color: palette.onSurface }]}>Take photo</Text>
          </Pressable>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setImagePickerDialogOpen(false)} textColor={palette.primary}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </>
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
  const [filterMode, setFilterMode] = useState("pending"); // all | pending | done
  const [deletingId, setDeletingId] = useState(null);
  const isDeletingRef = useRef(false);
  const colors = palette || getPalette(themeColors, isDark);
  const primary = colors.primary;

  const today = format(new Date(), "yyyy-MM-dd");
  const totalCount = reminders.length;
  const completedCount = reminders.filter((r) => r.completed).length;
  const pendingCount = totalCount - completedCount;
  const todayCount = reminders.filter((r) => format(parseISO(r.scheduledAt), "yyyy-MM-dd") === today).length;
  const completionPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const visibleReminders = reminders.filter((reminder) => {
    const haystack = `${reminder.title} ${reminder.description || ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    if (!matchesQuery) return false;
    if (filterMode === "today") return format(parseISO(reminder.scheduledAt), "yyyy-MM-dd") === today;
    if (filterMode === "pending") return !reminder.completed;
    if (filterMode === "done") return !!reminder.completed;
    return true;
  }).sort((a, b) => {
    // Sort by completed status (incomplete first, completed last)
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // Then sort by scheduled time (earliest first)
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });

  const filterChips = [
    { key: "pending", label: "Pending", icon: "clock-outline", count: pendingCount },
    { key: "done", label: "Done", icon: "check-circle-outline", count: completedCount },
    { key: "all", label: "All", icon: "view-grid-outline", count: totalCount }
  ];

  const handleDelete = (reminder) => {
    if (isDeletingRef.current) {
      return;
    }
    isDeletingRef.current = true;
    onDelete(reminder);
    setTimeout(() => {
      isDeletingRef.current = false;
    }, 800);
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
        ListHeaderComponent={
          <View style={styles.homeHeaderWrap}>
            <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
              <View style={[
                styles.heroBanner,
                { backgroundColor: colors.surface, borderColor: colors.outline },
                isDark && styles.cardOnDark
              ]}>
                <View style={[styles.heroBannerAccent, { backgroundColor: colors.primary }]} />
                <View style={styles.heroBannerRow}>
                  <View style={styles.heroBannerCopy}>
                    <Text style={[styles.heroBannerEyebrow, { color: colors.primary }]}>
                      {format(new Date(), "EEEE, MMM d")}
                    </Text>
                    <Text style={[styles.heroBannerTitle, isDark && styles.textOnDark]}>
                      {pendingCount === 0
                        ? "All caught up"
                        : pendingCount === 1
                          ? "1 reminder pending"
                          : `${pendingCount} reminders pending`}
                    </Text>
                    <Text style={[styles.heroBannerSubtitle, isDark && styles.mutedOnDark]}>
                      {completedCount} of {totalCount} completed
                    </Text>
                  </View>
                  <View style={[styles.heroRing, { borderColor: colors.surfaceVariant }]}>
                    <View style={[styles.heroRingInner, { backgroundColor: `${colors.primary}15` }]}>
                      <Text style={[styles.heroRingValue, { color: colors.primary }]}>{completionPct}%</Text>
                      <Text style={[styles.heroRingLabel, isDark && styles.mutedOnDark]}>done</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.heroProgressTrack, { backgroundColor: colors.surfaceVariant }]}>
                  <Animatable.View
                    animation="fadeInLeft"
                    duration={700}
                    useNativeDriver
                    style={[styles.heroProgressFill, { width: `${completionPct}%`, backgroundColor: colors.primary }]}
                  />
                </View>
              </View>
            </Animatable.View>

            <Animatable.View animation="fadeInUp" delay={120} duration={500} useNativeDriver>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {filterChips.map((chip) => {
                  const active = filterMode === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => setFilterMode(chip.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter: ${chip.label}`}
                      style={[
                        styles.filterChip,
                        isSmallScreen && styles.filterChipCompact,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.outline
                        }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={chip.icon}
                        size={isSmallScreen ? 12 : 14}
                        color={active ? colors.onPrimary : colors.onSurfaceVariant}
                      />
                      <Text style={[
                        styles.filterChipText,
                        isSmallScreen && styles.filterChipTextCompact,
                        { color: active ? colors.onPrimary : colors.onSurface }
                      ]}>{chip.label}</Text>
                      <View style={[
                        styles.filterChipCount,
                        isSmallScreen && styles.filterChipCountCompact,
                        { backgroundColor: active ? "rgba(255,255,255,0.22)" : colors.surfaceVariant }
                      ]}>
                        <Text style={[
                          styles.filterChipCountText,
                          isSmallScreen && styles.filterChipCountTextCompact,
                          { color: active ? colors.onPrimary : colors.onSurfaceVariant }
                        ]}>{chip.count}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animatable.View>
          </View>
        }
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
            <Pressable
              style={[
                styles.tableTaskRow,
                isSmallScreen && styles.tableTaskRowCompact,
                {
                  backgroundColor: colors.surface,
                  borderColor: reminder.completed ? colors.outline : colors.primary,
                  borderWidth: reminder.completed ? 1 : 1,
                  opacity: reminder.completed ? 0.5 : 1
                },
                isDark && styles.cardOnDark
              ]}
              onPress={() => onEdit(reminder)}
              accessibilityLabel={`Edit reminder: ${reminder.title}`}
            >
              <View style={styles.tableTaskLeft}>
                <View style={[styles.tableTaskIcon, { backgroundColor: isDark ? `${colors.primary}20` : `${colors.primary}15` }]}>
                  <VisualCue reminder={reminder} size={48} iconSize={24} compact palette={colors} />
                </View>
                <View style={styles.tableTaskInfo}>
                  <Text style={[styles.tableTaskTitle, isDark && styles.textOnDark, reminder.completed && styles.taskCompleted]} numberOfLines={2}>
                    {reminder.title}
                  </Text>
                  {reminder.description ? (
                    <Text style={[styles.tableTaskDesc, isDark && styles.mutedOnDark]} numberOfLines={2}>
                      {reminder.description}
                    </Text>
                  ) : null}
                  <View style={styles.tableTaskMeta}>
                    <Text style={[styles.tableTaskTime, { color: colors.primary }]}>
                      {reminder.hasDate ? format(parseISO(reminder.scheduledAt), "MMM dd, yyyy • h:mm a") : format(parseISO(reminder.scheduledAt), "h:mm a")}
                    </Text>
                    {reminder.hasDate && (
                      <Text style={[styles.tableTaskDate, isDark && styles.mutedOnDark]}>
                        {format(parseISO(reminder.scheduledAt), "EEEE")}
                      </Text>
                    )}
                  </View>
                  <View style={styles.tableTaskBadges}>
                    {reminder.priority === "high" && (
                      <View style={[styles.tableMetaBadge, { backgroundColor: isDark ? `${colors.error}20` : `${colors.error}15`, borderColor: colors.error }]}>
                        <MaterialCommunityIcons name="flag" size={10} color={colors.error} />
                        <Text style={[styles.tableMetaBadgeText, { color: colors.error }]}>High</Text>
                      </View>
                    )}
                    {reminder.repeat && (
                      <View style={[styles.tableMetaBadge, { backgroundColor: isDark ? `${colors.secondary || colors.primary}20` : `${colors.secondary || colors.primary}15`, borderColor: colors.secondary || colors.primary }]}>
                        <MaterialCommunityIcons name="repeat" size={10} color={colors.secondary || colors.primary} />
                        <Text style={[styles.tableMetaBadgeText, { color: colors.secondary || colors.primary }]}>Repeat</Text>
                      </View>
                    )}
                    {reminder.followUpEnabled && (
                      <View style={[styles.tableMetaBadge, { backgroundColor: isDark ? `${colors.primary}20` : `${colors.primary}15`, borderColor: colors.primary }]}>
                        <MaterialCommunityIcons name="bell-ring" size={10} color={colors.primary} />
                        <Text style={[styles.tableMetaBadgeText, { color: colors.primary }]}>Follow-up</Text>
                      </View>
                    )}
                    {reminder.important && (
                      <View style={[styles.tableMetaBadge, { backgroundColor: isDark ? `${colors.tertiary || colors.primary}20` : `${colors.tertiary || colors.primary}15`, borderColor: colors.tertiary || colors.primary }]}>
                        <MaterialCommunityIcons name="star" size={10} color={colors.tertiary || colors.primary} />
                        <Text style={[styles.tableMetaBadgeText, { color: colors.tertiary || colors.primary }]}>Important</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.tableTaskRight}>
                <Text style={[styles.tableTaskCountdown, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {getCountdownLabel(reminder.scheduledAt)}
                </Text>
                <View style={styles.tableTaskActions}>
                  <Pressable 
                    onPress={() => onToggle(reminder, !reminder.completed)} 
                    style={[styles.tableCompleteButton, { 
                      backgroundColor: reminder.completed ? colors.success : (isDark ? `${colors.primary}15` : `${colors.primary}20`),
                      borderColor: reminder.completed ? colors.success : colors.primary
                    }]}
                    accessibilityLabel={reminder.completed ? "Mark as incomplete" : "Mark as complete"}
                  >
                    <MaterialCommunityIcons 
                      name={reminder.completed ? "check-circle" : "checkbox-blank-circle-outline"} 
                      size={20} 
                      color={reminder.completed ? "#FFFFFF" : colors.primary} 
                    />
                  </Pressable>
                  <Pressable onPress={() => onEdit(reminder)} style={styles.tableActionIcon} accessibilityLabel="Edit reminder">
                    <MaterialCommunityIcons name="pencil" size={16} color={colors.onSurfaceVariant} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(reminder)} style={styles.tableActionIcon} accessibilityLabel="Delete reminder">
                    <MaterialCommunityIcons name="trash-can" size={16} color={deletingId === reminder.id ? colors.onSurfaceDisabled : (colors.error || "#FF3B30")} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
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
  const [visualPickerOpen, setVisualPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [ringtonePickerOpen, setRingtonePickerOpen] = useState(false);
  const [followUpCountPickerOpen, setFollowUpCountPickerOpen] = useState(false);
  const [followUpIntervalPickerOpen, setFollowUpIntervalPickerOpen] = useState(false);
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
        display: "spinner",
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
    if (Platform.OS === "web") {
      // For web, use HTML input
      const input = document.createElement('input');
      input.type = 'time';
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      input.style.visibility = 'hidden';
      document.body.appendChild(input);
      
      // Set min to current time if date is today
      const now = new Date();
      const isToday = currentScheduled.toDateString() === now.toDateString();
      if (isToday) {
        const minTime = now.toTimeString().slice(0, 5);
        input.min = minTime;
      }
      
      const cleanup = () => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      };
      
      input.addEventListener('change', (e) => {
        const [hours, minutes] = e.target.value.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const nextDate = set(currentScheduled, {
            hours,
            minutes,
            seconds: 0,
            milliseconds: 0
          });
          // Validate not in the past
          if (nextDate >= now || !isToday) {
            onUpdate({ scheduledAt: nextDate.toISOString(), timeSet: true });
          } else {
            alert("Please select a time in the future");
          }
        }
        cleanup();
      });
      
      input.addEventListener('cancel', cleanup);
      
      input.showPicker ? input.showPicker() : input.click();
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
        display: "spinner",
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
    if (Platform.OS === "web") {
      // For web, use HTML input
      const input = document.createElement('input');
      input.type = 'date';
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      input.style.visibility = 'hidden';
      document.body.appendChild(input);
      
      // Set min to today's date
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      input.min = today;
      
      const cleanup = () => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      };
      
      input.addEventListener('change', (e) => {
        if (e.target.value) {
          const selectedDate = new Date(e.target.value);
          if (!isNaN(selectedDate.getTime())) {
            // Validate not in the past
            selectedDate.setHours(0, 0, 0, 0);
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            
            if (selectedDate >= todayMidnight) {
              const nextDate = set(selectedDate, {
                hours: currentScheduled.getHours(),
                minutes: currentScheduled.getMinutes(),
                seconds: 0,
                milliseconds: 0
              });
              onUpdate({ scheduledAt: nextDate.toISOString(), hasDate: true });
            } else {
              alert("Please select a date in the future");
            }
          }
        }
        cleanup();
      });
      
      input.addEventListener('cancel', cleanup);
      
      input.showPicker ? input.showPicker() : input.click();
      return;
    }
    setDateOpen(true);
  };
  const openVisualPicker = () => {
    setVisualPickerOpen(true);
  };

  const openIconPicker = () => {
    setVisualPickerOpen(false);
    setIconPickerOpen(true);
  };

  const openEmojiPicker = () => {
    setVisualPickerOpen(false);
    setEmojiPickerOpen(true);
  };

  const openRingtonePicker = () => {
    console.log("openRingtonePicker called");
    setRingtonePickerOpen(true);
  };
  const openRepeatUntilPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: repeatUntilValue,
        mode: "date",
        display: "spinner",
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
    setFollowUpCountPickerOpen(true);
  };
  const openFollowUpIntervalPicker = () => {
    console.log("openFollowUpIntervalPicker called");
    setFollowUpIntervalPickerOpen(true);
  };
  const ringtoneLabel = RINGTONE_OPTIONS.find(([value]) => value === reminder.ringtone)?.[1] || "System alarm";
  return (
    <Animatable.View animation="fadeInUp" duration={300} style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]} useNativeDriver>
      <ScreenTitle isDark={isDark}>{mode === "add" ? "New Reminder" : "Edit Reminder"}</ScreenTitle>
      <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        {reminder.imageUri || reminder.icon || reminder.emoji ? (
          <View style={styles.imageEditWrap}>
            <VisualCue reminder={reminder} size={112} iconSize={52} palette={colors} />
            <Pressable style={[styles.editFab, { backgroundColor: colors.primary }]} onPress={openVisualPicker}>
              <MaterialCommunityIcons name="pencil" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable 
            style={[styles.attachImageButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.outline }]} 
            onPress={openVisualPicker}
          >
            <MaterialCommunityIcons name="image-plus" size={32} color={colors.primary} />
            <Text style={[styles.attachImageText, { color: colors.onSurface }]}>Add Photo (Optional)</Text>
          </Pressable>
        )}

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
              android_ripple={{ color: colors.primary + '20', borderless: false }}
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
              android_ripple={{ color: colors.primary + '20', borderless: false }}
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
      {visualPickerOpen ? (
        <Portal>
          <Dialog visible={visualPickerOpen} onDismiss={() => setVisualPickerOpen(false)} style={{ backgroundColor: colors.surface }}>
            <Dialog.Title style={{ color: colors.onSurface }}>Choose Visual Cue</Dialog.Title>
            <Dialog.Content>
              <Pressable
                style={[styles.visualOptionButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={onAttachImage}
              >
                <MaterialCommunityIcons name="camera" size={24} color={colors.primary} />
                <Text style={[styles.visualOptionText, { color: colors.onSurface }]}>Photo (Camera or Gallery)</Text>
              </Pressable>
              <Pressable
                style={[styles.visualOptionButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={openIconPicker}
              >
                <MaterialCommunityIcons name="emoticon-outline" size={24} color={colors.primary} />
                <Text style={[styles.visualOptionText, { color: colors.onSurface }]}>Icon</Text>
              </Pressable>
              <Pressable
                style={[styles.visualOptionButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={openEmojiPicker}
              >
                <MaterialCommunityIcons name="emoticon" size={24} color={colors.primary} />
                <Text style={[styles.visualOptionText, { color: colors.onSurface }]}>Emoji</Text>
              </Pressable>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setVisualPickerOpen(false)} textColor={colors.primary}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}
      {iconPickerOpen ? (
        <Portal>
          <Dialog visible={iconPickerOpen} onDismiss={() => setIconPickerOpen(false)} style={{ backgroundColor: colors.surface }}>
            <Dialog.Title style={{ color: colors.onSurface }}>Select Icon</Dialog.Title>
            <Dialog.Content>
              <ScrollView style={{ maxHeight: 300 }}>
                <View style={styles.choiceGrid}>
                  {ICON_OPTIONS.map((icon) => (
                    <Pressable
                      key={icon}
                      style={[styles.visualChoice, { backgroundColor: colors.surfaceVariant }, reminder.icon === icon && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => {
                        onUpdate({ visualType: "icon", icon, emoji: null, imageUri: null });
                        setIconPickerOpen(false);
                      }}
                    >
                      <MaterialCommunityIcons name={icon} size={28} color={reminder.icon === icon ? colors.onPrimary : colors.onSurface} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setIconPickerOpen(false)} textColor={colors.primary}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}
      {emojiPickerOpen ? (
        <Portal>
          <Dialog visible={emojiPickerOpen} onDismiss={() => setEmojiPickerOpen(false)} style={{ backgroundColor: colors.surface }}>
            <Dialog.Title style={{ color: colors.onSurface }}>Select Emoji</Dialog.Title>
            <Dialog.Content>
              <ScrollView style={{ maxHeight: 300 }}>
                <View style={styles.choiceGrid}>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      style={[styles.visualChoice, { backgroundColor: colors.surfaceVariant }, reminder.emoji === emoji && { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}
                      onPress={() => {
                        onUpdate({ visualType: "emoji", emoji, icon: null, imageUri: null });
                        setEmojiPickerOpen(false);
                      }}
                    >
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEmojiPickerOpen(false)} textColor={colors.primary}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}
      {ringtonePickerOpen ? (
        <Portal>
          <Dialog visible={ringtonePickerOpen} onDismiss={() => setRingtonePickerOpen(false)} style={{ backgroundColor: colors.surface }}>
            <Dialog.Title style={{ color: colors.onSurface }}>Reminder Sound</Dialog.Title>
            <Dialog.Content>
              <Text style={[{ color: colors.onSurfaceVariant, marginBottom: 12 }]}>Choose the sound used by the full-screen alarm.</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {RINGTONE_OPTIONS.map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.visualOptionButton, { backgroundColor: colors.surfaceVariant }, reminder.ringtone === value && { backgroundColor: colors.primaryContainer }]}
                    onPress={() => {
                      onUpdate({ ringtone: value });
                      setRingtonePickerOpen(false);
                    }}
                  >
                    <Text style={[styles.visualOptionText, { color: reminder.ringtone === value ? colors.primary : colors.onSurface }]}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setRingtonePickerOpen(false)} textColor={colors.primary}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}
      {followUpCountPickerOpen ? (
        <Portal>
          <Dialog visible={followUpCountPickerOpen} onDismiss={() => setFollowUpCountPickerOpen(false)} style={{ backgroundColor: colors.surface }}>
            <Dialog.Title style={{ color: colors.onSurface }}>Follow-up Reminders</Dialog.Title>
            <Dialog.Content>
              <Text style={[{ color: colors.onSurfaceVariant, marginBottom: 12 }]}>How many extra reminders should fire after the first alert?</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {FOLLOW_UP_COUNTS.map((count) => (
                  <Pressable
                    key={count}
                    style={[styles.visualOptionButton, { backgroundColor: colors.surfaceVariant }, reminder.followUpCount === count && { backgroundColor: colors.primaryContainer }]}
                    onPress={() => {
                      onUpdate({ followUpEnabled: count > 0, followUpCount: count });
                      setFollowUpCountPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.visualOptionText, { color: reminder.followUpCount === count ? colors.primary : colors.onSurface }]}>
                      {count === 0 ? "Off" : `${count} time${count > 1 ? "s" : ""}`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setFollowUpCountPickerOpen(false)} textColor={colors.primary}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}
      {followUpIntervalPickerOpen ? (
        <Portal>
          <Dialog visible={followUpIntervalPickerOpen} onDismiss={() => setFollowUpIntervalPickerOpen(false)} style={{ backgroundColor: colors.surface }}>
            <Dialog.Title style={{ color: colors.onSurface }}>Follow-up Interval</Dialog.Title>
            <Dialog.Content>
              <Text style={[{ color: colors.onSurfaceVariant, marginBottom: 12 }]}>How long should VizMinder wait between follow-up reminders?</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {FOLLOW_UP_INTERVALS.map((minutes) => (
                  <Pressable
                    key={minutes}
                    style={[styles.visualOptionButton, { backgroundColor: colors.surfaceVariant }, reminder.followUpIntervalMinutes === minutes && { backgroundColor: colors.primaryContainer }]}
                    onPress={() => {
                      onUpdate({ followUpIntervalMinutes: minutes });
                      setFollowUpIntervalPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.visualOptionText, { color: reminder.followUpIntervalMinutes === minutes ? colors.primary : colors.onSurface }]}>
                      {minutes} minute{minutes > 1 ? "s" : ""}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setFollowUpIntervalPickerOpen(false)} textColor={colors.primary}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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

  const statsCards = [
    {
      icon: "chart-line",
      iconColor: colors.primary,
      title: "Completion Rate",
      value: `${completionRate}%`,
      subtitle: `${completedCount} of ${totalReminders} completed`,
      showProgress: true,
      progress: completionRate
    },
    {
      icon: "star",
      iconColor: "#FF9500",
      title: "Important Reminders",
      value: importantReminders.toString(),
      subtitle: `${completedImportant} completed`,
      isDouble: true,
      secondValue: completedImportant.toString(),
      secondLabel: "Completed"
    },
    {
      icon: "calendar-today",
      iconColor: "#34C759",
      title: "Today's Reminders",
      value: todayReminders.toString(),
      subtitle: "Scheduled for today"
    },
    {
      icon: "fire",
      iconColor: "#FF3B30",
      title: "Best Streak",
      value: streak.toString(),
      subtitle: "Consecutive days"
    }
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Stats</ScreenTitle>
      <ScrollView contentContainerStyle={[styles.statsContent, isSmallScreen && styles.statsContentCompact]} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
          <View style={[
            styles.statsHeroCard,
            { 
              backgroundColor: isDark ? colors.primary : colors.surface,
              borderColor: colors.primary 
            },
            isDark && styles.cardOnDark
          ]}>
            <View style={styles.statsHeroRow}>
              <View style={styles.statsHeroCopy}>
                <Text style={[styles.statsHeroEyebrow, { color: isDark ? colors.onPrimary : colors.primary }]}>Your Progress</Text>
                <Text style={[styles.statsHeroTitle, isDark && styles.textOnDark]}>
                  {completionRate === 100 && totalReminders > 0 ? "Perfect Day! 🎉" : completionRate >= 75 ? "Great Pace! 💪" : completionRate >= 40 ? "Keep Going! 🚀" : "Let's Start! 🌟"}
                </Text>
                <Text style={[styles.statsHeroSubtitle, isDark && styles.mutedOnDark]}>
                  {completedCount} of {totalReminders} reminders completed
                </Text>
              </View>
              <Animatable.View animation="zoomIn" duration={600} useNativeDriver style={[styles.statsHeroRing, { 
                borderColor: colors.primary, 
                backgroundColor: isDark ? colors.onPrimaryVariant : `${colors.primary}15` 
              }]}>
                <Text style={[styles.statsHeroRingValue, { color: colors.primary }]}>{completionRate}%</Text>
              </Animatable.View>
            </View>
            <View style={[styles.statsHeroProgressTrack, { backgroundColor: isDark ? colors.onPrimaryVariant : colors.surfaceVariant }]}>
              <Animatable.View
                animation="fadeInLeft"
                duration={800}
                useNativeDriver
                style={[styles.statsHeroProgressFill, { width: `${completionRate}%`, backgroundColor: colors.primary }]}
              />
            </View>
            <View style={styles.statsHeroMetaRow}>
              <View style={styles.statsHeroMetaItem}>
                <MaterialCommunityIcons name="calendar-today" size={16} color={isDark ? colors.onPrimaryVariant : colors.onSurfaceVariant} />
                <Text style={[styles.statsHeroMetaText, isDark && styles.mutedOnDark]}>{todayReminders} today</Text>
              </View>
              <View style={styles.statsHeroMetaItem}>
                <MaterialCommunityIcons name="star" size={16} color={isDark ? colors.onPrimaryVariant : colors.onSurfaceVariant} />
                <Text style={[styles.statsHeroMetaText, isDark && styles.mutedOnDark]}>{importantReminders} important</Text>
              </View>
              <View style={styles.statsHeroMetaItem}>
                <MaterialCommunityIcons name="fire" size={16} color={isDark ? colors.onPrimaryVariant : colors.onSurfaceVariant} />
                <Text style={[styles.statsHeroMetaText, isDark && styles.mutedOnDark]}>{streak} streak</Text>
              </View>
            </View>
          </View>
        </Animatable.View>

        <View style={styles.statsGrid}>
          {statsCards.map((card, index) => (
            <Animatable.View 
              key={card.title} 
              animation="fadeInUp" 
              delay={150 + index * 90} 
              duration={420} 
              useNativeDriver
              style={{ width: "48%", marginBottom: 8 }}
            >
              <Pressable style={[
                styles.modernStatsCard,
                isSmallScreen && styles.modernStatsCardCompact,
                isLargeScreen && styles.modernStatsCardLarge,
                { 
                  backgroundColor: colors.surface,
                  borderColor: isDark ? colors.outline : colors.outline
                },
                isDark && styles.cardOnDark
              ]}>
                <View style={styles.statsCardRow}>
                  <View style={[styles.statsCardIcon, { backgroundColor: isDark ? `${card.iconColor}20` : `${card.iconColor}15` }]}>
                    <MaterialCommunityIcons name={card.icon} size={26} color={card.iconColor} />
                  </View>
                  <View style={styles.statsCardContent}>
                    <Text style={[styles.modernStatsTitle, isDark && styles.textOnDark]}>{card.title}</Text>
                    <Text style={[styles.modernStatsValue, { color: card.iconColor }]}>{card.value}</Text>
                    {card.isDouble ? (
                      <View style={styles.statsDoubleRow}>
                        <Text style={[styles.modernStatsSubtitle, isDark && styles.mutedOnDark]}>{card.subtitle}</Text>
                        <View style={[styles.statsMiniBadge, { backgroundColor: isDark ? `${colors.success}20` : `${colors.success}15`, borderColor: colors.success }]}>
                          <Text style={[styles.statsMiniBadgeText, { color: colors.success }]}>{card.secondValue}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.modernStatsSubtitle, isDark && styles.mutedOnDark]}>{card.subtitle}</Text>
                    )}
                    {card.showProgress && (
                      <View style={[styles.modernProgressBar, { backgroundColor: colors.surfaceVariant }]}>
                        <View style={[styles.modernProgressFill, { width: `${card.progress}%`, backgroundColor: card.iconColor }]} />
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            </Animatable.View>
          ))}
        </View>
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

  const signedIn = authUser && !authUser.isAnonymous && authUser.uid !== "offline-user";
  const accountLabel = signedIn ? (authUser.email && authUser.email !== "null" ? authUser.email : "Email account") : authUser?.isAnonymous ? "Anonymous session" : "Not signed in";

  const submitEmailAuth = async (mode) => {
    setSyncError("");
    
    // Validate email
    if (!email || !email.includes('@') || !email.includes('.')) {
      setSyncError("Please enter a valid email address.");
      return;
    }
    
    // Validate password (Firebase requires min 6 characters)
    if (!password || password.length < 6) {
      setSyncError("Password must be at least 6 characters.");
      return;
    }
    
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
      // Extract meaningful error message from Firebase error
      const errorCode = error.code;
      let errorMessage = error.message;
      
      if (errorCode === 'auth/email-already-in-use') {
        errorMessage = "Email already registered. Please sign in instead.";
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = "Password is too weak. Use at least 6 characters.";
      } else if (errorCode === 'auth/user-not-found') {
        errorMessage = "No account found with this email.";
      } else if (errorCode === 'auth/wrong-password') {
        errorMessage = "Incorrect password.";
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please try again later.";
      }
      
      setSyncError(errorMessage);
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
      <ScrollView contentContainerStyle={[styles.accountContent, isSmallScreen && styles.accountContentCompact]} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
          <View style={[
            styles.modernAccountCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outline
            },
            isDark && styles.cardOnDark
          ]}>
            <View style={[styles.accountTint, { backgroundColor: `${colors.primary}12`, pointerEvents: "none" }]} />
            <Animatable.View animation="zoomIn" duration={500} useNativeDriver style={[styles.accountAvatar, { backgroundColor: `${colors.primary}25`, borderColor: `${colors.primary}40` }]}>
              <MaterialCommunityIcons name="account-circle" size={isSmallScreen ? 44 : 52} color={colors.primary} />
            </Animatable.View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, isDark && styles.textOnDark]}>{signedIn ? "Welcome back" : "Guest user"}</Text>
              <Text style={[styles.accountEmail, isDark && styles.mutedOnDark]} numberOfLines={1}>{accountLabel}</Text>
              <View style={[styles.accountStatusBadge, { backgroundColor: signedIn ? `${colors.success}20` : `${colors.onSurfaceVariant}20`, alignSelf: "flex-start", marginTop: 6 }]}>
                <MaterialCommunityIcons name={signedIn ? "check-circle" : "alert-circle"} size={14} color={signedIn ? colors.success : colors.onSurfaceVariant} />
                <Text style={[styles.accountStatusText, { color: signedIn ? colors.success : colors.onSurfaceVariant }]}>
                  {signedIn ? "Connected" : "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </Animatable.View>

        {!signedIn ? (
          <Animatable.View animation="fadeInUp" delay={100} duration={500} useNativeDriver>
            <View style={[
              styles.modernAuthCard,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.outline
              },
              isDark && styles.cardOnDark
            ]}>
              <View style={styles.authHeader}>
                <MaterialCommunityIcons name="login" size={32} color={colors.primary} />
                <Text style={[styles.authTitle, isDark && styles.textOnDark]}>Sign In</Text>
                <Text style={[styles.authSubtitle, isDark && styles.mutedOnDark]}>Access your reminders across devices</Text>
              </View>
              <TextInput 
                value={email} 
                onChangeText={setEmail} 
                label="Email" 
                autoCapitalize="none" 
                keyboardType="email-address" 
                mode="outlined"
                style={styles.authInput} 
                textColor={colors.onSurface}
                outlineColor={colors.outline}
                activeOutlineColor={colors.primary}
              />
              <TextInput 
                value={password} 
                onChangeText={setPassword} 
                label="Password" 
                secureTextEntry 
                mode="outlined"
                style={styles.authInput} 
                textColor={colors.onSurface}
                outlineColor={colors.outline}
                activeOutlineColor={colors.primary}
              />
              {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
              <View style={styles.authActions}>
                <Button 
                  mode="outlined" 
                  textColor={colors.primary} 
                  style={styles.authButton} 
                  onPress={() => submitEmailAuth("login")}
                  icon="login"
                >
                  Sign In
                </Button>
                <Button 
                  mode="contained" 
                  buttonColor={colors.primary} 
                  style={styles.authButton} 
                  onPress={() => submitEmailAuth("register")}
                  icon="account-plus"
                >
                  Create Account
                </Button>
              </View>
            </View>
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeInUp" delay={100} duration={500} useNativeDriver>
            <View style={[
              styles.modernAuthCard,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.outline
              },
              isDark && styles.cardOnDark
            ]}>
              <View style={styles.authHeader}>
                <MaterialCommunityIcons name="cloud-check" size={32} color={colors.success} />
                <Text style={[styles.authTitle, isDark && styles.textOnDark]}>Cloud Sync</Text>
                <Text style={[styles.authSubtitle, isDark && styles.mutedOnDark]}>Sync reminders across devices</Text>
              </View>
              <View style={styles.syncStats}>
                <View style={styles.syncStatItem}>
                  <Text style={[styles.syncStatValue, { color: colors.primary }]}>{completedCount}</Text>
                  <Text style={[styles.syncStatLabel, isDark && styles.mutedOnDark]}>Completed</Text>
                </View>
                <View style={styles.syncStatItem}>
                  <Text style={[styles.syncStatValue, { color: colors.primary }]}>{reminders.length}</Text>
                  <Text style={[styles.syncStatLabel, isDark && styles.mutedOnDark]}>Total</Text>
                </View>
              </View>
              {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
              <View style={[styles.syncProgressContainer, { backgroundColor: colors.surfaceVariant }]}>
                <View style={[styles.syncProgressBar, { backgroundColor: colors.primary, width: `${Math.round(syncProgress * 100)}%` }]} />
              </View>
              <Button 
                mode="contained" 
                buttonColor={colors.primary} 
                loading={syncing} 
                disabled={syncing} 
                onPress={runSync}
                style={styles.syncButton}
                icon="cloud-sync"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button 
                mode="outlined" 
                textColor={colors.error} 
                onPress={() => signOutUser().catch((error) => setSyncError(error.message))}
                style={styles.signOutButton}
                icon="logout"
              >
                Sign Out
              </Button>
            </View>
          </Animatable.View>
        )}

        {signedIn && syncRows.length > 0 && (
          <Animatable.View animation="fadeInUp" delay={200} duration={500} useNativeDriver>
            <View style={[
              styles.modernSyncListCard,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.outline
              },
              isDark && styles.cardOnDark
            ]}>
              <Text style={[styles.syncListTitle, isDark && styles.textOnDark]}>Sync Status</Text>
              {syncRows.map((row) => (
                <View key={row.id} style={styles.syncListItem}>
                  <Text style={[styles.syncListItemText, isDark && styles.mutedOnDark]} numberOfLines={1}>{row.title}</Text>
                  <View style={[styles.syncListBadge, { backgroundColor: row.status === "Synced" ? `${colors.success}20` : `${colors.warning}20` }]}>
                    <MaterialCommunityIcons name={row.status === "Synced" ? "check" : "alert"} size={14} color={row.status === "Synced" ? colors.success : colors.warning} />
                    <Text style={[styles.syncListBadgeText, { color: row.status === "Synced" ? colors.success : colors.warning }]}>{row.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animatable.View>
        )}
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
    { icon: "palette-outline", color: colors.primary, title: "Theme", copy: "Light, dark, and Material color options.", action: () => setSettingsPage("theme") },
    { icon: "tune-vertical", color: colors.secondary || colors.primary, title: "Advanced", copy: "Debug controls and native alarm notes.", action: () => setSettingsPage("advanced") },
    { icon: "bell-outline", color: colors.warning || "#FF9500", title: "Notification", copy: "Permissions, alert sound, and system settings.", action: () => setSettingsPage("notification") },
    { icon: "restart", color: colors.error, title: "Reset Reminders", copy: "Clear all reminders on this device.", action: onReset, destructive: true }
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
        <View style={styles.settingsCardList}>
          {items.map((item, index) => (
            <Animatable.View
              key={item.title}
              animation="fadeInUp"
              delay={index * 70}
              duration={420}
              useNativeDriver
            >
              <Pressable
                android_ripple={{ color: `${item.color}22` }}
                style={[
                  styles.settingsRowCard,
                  { backgroundColor: colors.surface, borderColor: colors.outline },
                  isDark && styles.cardOnDark
                ]}
                onPress={item.action}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View style={[styles.settingsRowIcon, { backgroundColor: `${item.color}1F` }]}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.settingsCopy}>
                  <Text style={[
                    styles.settingsRowTitle,
                    isDark && styles.textOnDark,
                    item.destructive && { color: item.color }
                  ]}>{item.title}</Text>
                  <Text style={[styles.settingsRowSubtitle, isDark && styles.mutedOnDark]}>{item.copy}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            </Animatable.View>
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

  const deviceCards = [
    {
      icon: "battery-charging",
      iconColor: batteryInfo?.isCharging ? "#34C759" : batteryInfo?.isLow ? "#FF3B30" : "#007AFF",
      title: "Battery",
      value: batteryInfo && batteryInfo.level != null ? `${Math.round(batteryInfo.level)}%` : "Unknown",
      subtitle: batteryInfo?.isCharging ? "Charging" : "Not charging",
      action: onRefreshBattery,
      actionIcon: "refresh",
      actionLabel: "Refresh"
    },
    {
      icon: networkState?.isConnected ? "wifi" : "wifi-off",
      iconColor: networkState?.isConnected ? "#34C759" : "#FF3B30",
      title: "Network",
      value: networkState?.isConnected ? "Connected" : "Offline",
      subtitle: networkTypeLabel,
      action: onRefreshNetwork,
      actionIcon: "refresh",
      actionLabel: "Refresh"
    },
    {
      icon: "map-marker",
      iconColor: currentLocation ? "#34C759" : "#86868B",
      title: "Location",
      value: currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : "Not available",
      subtitle: "GPS coordinates",
      hasMap: true,
      showMap,
      onToggleMap: () => setShowMap(!showMap),
      action: onRefreshLocation,
      actionIcon: "crosshairs-gps",
      actionLabel: "Refresh"
    },
    {
      icon: biometricAvailable ? "fingerprint" : "fingerprint-off",
      iconColor: biometricAvailable ? "#34C759" : "#86868B",
      title: "Biometrics",
      value: biometricAvailable ? "Available" : "Not available",
      subtitle: "Fingerprint or Face ID",
      action: biometricAvailable ? handleBiometricAuth : null,
      actionIcon: "fingerprint",
      actionLabel: "Test"
    },
    {
      icon: torchAvailable ? "flashlight" : "flashlight-off",
      iconColor: torchOn ? "#FF9500" : torchAvailable ? "#34C759" : "#86868B",
      title: "Torch",
      value: torchAvailable ? "Available" : "Not available",
      subtitle: torchOn ? "On" : "Off",
      action: torchAvailable ? handleTorchToggle : null,
      actionIcon: torchOn ? "flashlight-off" : "flashlight",
      actionLabel: torchOn ? "Turn Off" : "Turn On"
    }
  ];

  const batteryLevel = batteryInfo && batteryInfo.level != null ? Math.round(batteryInfo.level) : null;
  const platformLabel = Platform.OS === "ios" ? "iOS Device" : Platform.OS === "android" ? "Android Device" : "Web Device";
  const networkIcon = networkState?.isConnected ? "wifi" : "wifi-off";
  const networkColor = networkState?.isConnected ? (colors.success || "#34C759") : (colors.error || "#FF3B30");

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, isDark && styles.screenDark]}>
      <ScreenTitle isDark={isDark}>Device</ScreenTitle>
      <ScrollView contentContainerStyle={[styles.deviceContent, isSmallScreen && styles.deviceContentCompact]} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
          <View style={[
            styles.deviceHeroCard,
            { backgroundColor: colors.surface, borderColor: colors.outline },
            isDark && styles.cardOnDark
          ]}>
            <View style={[styles.deviceHeroAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.deviceHeroRow}>
              <View style={styles.deviceHeroCopy}>
                <Text style={[styles.deviceHeroEyebrow, { color: colors.primary }]}>Live device telemetry</Text>
                <Text style={[styles.deviceHeroTitle, isDark && styles.textOnDark]}>{platformLabel}</Text>
                <View style={styles.deviceHeroChipsRow}>
                  <View style={[styles.deviceHeroChip, { backgroundColor: `${networkColor}1F` }]}>
                    <MaterialCommunityIcons name={networkIcon} size={12} color={networkColor} />
                    <Text style={[styles.deviceHeroChipText, { color: networkColor }]}>{networkTypeLabel}</Text>
                  </View>
                  <View style={[styles.deviceHeroChip, { backgroundColor: currentLocation ? `${colors.success}1F` : `${colors.onSurfaceVariant}1F` }]}>
                    <MaterialCommunityIcons name="map-marker" size={12} color={currentLocation ? colors.success : colors.onSurfaceVariant} />
                    <Text style={[styles.deviceHeroChipText, { color: currentLocation ? colors.success : colors.onSurfaceVariant }]}>
                      {currentLocation ? "Located" : "No GPS"}
                    </Text>
                  </View>
                </View>
              </View>
              <Animatable.View animation="zoomIn" duration={500} useNativeDriver style={[styles.deviceHeroRing, { borderColor: batteryLevel != null && batteryLevel <= 20 ? colors.error : colors.primary, backgroundColor: `${colors.primary}10` }]}>
                <MaterialCommunityIcons
                  name={batteryInfo?.isCharging ? "battery-charging" : "battery"}
                  size={18}
                  color={batteryLevel != null && batteryLevel <= 20 ? colors.error : colors.primary}
                />
                <Text style={[styles.deviceHeroRingValue, { color: batteryLevel != null && batteryLevel <= 20 ? colors.error : colors.primary }]}>
                  {batteryLevel != null ? `${batteryLevel}%` : "--"}
                </Text>
              </Animatable.View>
            </View>
          </View>
        </Animatable.View>

        <View style={styles.deviceRowsList}>
          {deviceCards.map((card, index) => {
            const isLocation = card.hasMap;
            const mapExpanded = isLocation && showMap && currentLocation;
            return (
              <Animatable.View
                key={card.title}
                animation="fadeInUp"
                delay={120 + index * 80}
                duration={420}
                useNativeDriver
              >
                <View style={[
                  styles.deviceRowCard,
                  { backgroundColor: colors.surface, borderColor: colors.outline },
                  isDark && styles.cardOnDark
                ]}>
                  <View style={[styles.deviceRowAccent, { backgroundColor: card.iconColor }]} />
                  <View style={styles.deviceRowMain}>
                    <View style={[styles.deviceRowIcon, { backgroundColor: `${card.iconColor}1F` }]}>
                      <MaterialCommunityIcons name={card.icon} size={22} color={card.iconColor} />
                    </View>
                    <View style={styles.deviceRowCopy}>
                      <Text style={[styles.deviceRowTitle, isDark && styles.textOnDark]}>{card.title}</Text>
                      <Text style={[styles.deviceRowValue, { color: card.iconColor }]} numberOfLines={1}>{card.value}</Text>
                      <Text style={[styles.deviceRowSubtitle, isDark && styles.mutedOnDark]} numberOfLines={1}>{card.subtitle}</Text>
                    </View>
                    <View style={styles.deviceRowActions}>
                      {isLocation && currentLocation ? (
                        <Pressable
                          onPress={card.onToggleMap}
                          style={[styles.deviceIconButton, { backgroundColor: `${card.iconColor}1A`, borderColor: `${card.iconColor}40` }]}
                          accessibilityRole="button"
                          accessibilityLabel={mapExpanded ? "Hide map" : "Show map"}
                        >
                          <MaterialCommunityIcons name={mapExpanded ? "chevron-up" : "map"} size={18} color={card.iconColor} />
                        </Pressable>
                      ) : null}
                      {card.action ? (
                        <Pressable
                          onPress={card.action}
                          style={[styles.deviceIconButton, { backgroundColor: `${card.iconColor}1A`, borderColor: `${card.iconColor}40` }]}
                          accessibilityRole="button"
                          accessibilityLabel={card.actionLabel}
                        >
                          <MaterialCommunityIcons name={card.actionIcon} size={18} color={card.iconColor} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {mapExpanded ? (
                    <Animatable.View animation="fadeIn" duration={300} useNativeDriver style={styles.deviceMapContainer}>
                      <LocationMap location={currentLocation} reminders={reminders} style={styles.deviceMap} />
                    </Animatable.View>
                  ) : null}
                </View>
              </Animatable.View>
            );
          })}
        </View>

        <Animatable.View animation="fadeInUp" delay={500} duration={420} useNativeDriver>
          <View style={[
            styles.sensorCard,
            { backgroundColor: colors.surface, borderColor: colors.outline },
            isDark && styles.cardOnDark
          ]}>
            <View style={styles.sensorCardHeader}>
              <View style={[styles.deviceRowIcon, { backgroundColor: `${colors.primary}1F` }]}>
                <MaterialCommunityIcons name="motion-sensor" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.deviceRowTitle, isDark && styles.textOnDark]}>Sensors</Text>
                <Text style={[styles.deviceRowSubtitle, isDark && styles.mutedOnDark]}>Live motion samples</Text>
              </View>
            </View>

            {[
              { key: "accel", icon: "rotate-3d", label: "Accelerometer", data: accelData, action: readAccelerometer },
              { key: "gyro", icon: "compass-outline", label: "Gyroscope", data: gyroData, action: readGyroscope }
            ].map((sensor, idx) => (
              <View key={sensor.key} style={[styles.sensorItem, idx > 0 && { marginTop: 10 }, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }]}>
                <View style={styles.sensorItemHeader}>
                  <MaterialCommunityIcons name={sensor.icon} size={18} color={colors.primary} />
                  <Text style={[styles.sensorItemLabel, isDark && styles.textOnDark]}>{sensor.label}</Text>
                  <Pressable
                    onPress={sensor.action}
                    disabled={readingSensor}
                    style={[
                      styles.sensorReadBtn,
                      { backgroundColor: `${colors.primary}1F`, borderColor: `${colors.primary}40`, opacity: readingSensor ? 0.5 : 1 }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Read ${sensor.label}`}
                  >
                    <MaterialCommunityIcons name="play" size={14} color={colors.primary} />
                    <Text style={[styles.sensorReadBtnText, { color: colors.primary }]}>Read</Text>
                  </Pressable>
                </View>
                <Text style={[styles.sensorAxisText, isDark && styles.mutedOnDark]}>{formatAxis(sensor.data)}</Text>
              </View>
            ))}
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={600} duration={420} useNativeDriver>
          <View style={[
            styles.securityBanner,
            { backgroundColor: colors.surface, borderColor: colors.outline },
            isDark && styles.cardOnDark
          ]}>
            <View style={[styles.securityBannerIcon, { backgroundColor: `${colors.success}1F` }]}>
              <MaterialCommunityIcons name="shield-check" size={22} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deviceRowTitle, isDark && styles.textOnDark]}>Security</Text>
              <Text style={[styles.deviceRowSubtitle, isDark && styles.mutedOnDark]}>AES encryption enabled for sensitive data</Text>
            </View>
            <View style={[styles.securityPill, { backgroundColor: `${colors.success}1F` }]}>
              <Text style={[styles.securityPillText, { color: colors.success }]}>Protected</Text>
            </View>
          </View>
        </Animatable.View>
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
    ["device", "devices", "Device"],
    ["account", "account-circle", "Account"],
    ["settings", "cog", "Settings"]
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

  if (visualType === "emoji" && reminder.emoji) {
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
          {reminder.emoji}
        </Text>
      </View>
    );
  }

  if (visualType === "icon" && reminder.icon) {
    return (
      <View style={[styles.imagePlaceholder, { backgroundColor: colors.primaryContainer, height: size, width: size }]}>
        <MaterialCommunityIcons name={reminder.icon} size={iconSize} color={colors.primary} />
      </View>
    );
  }

  // Return null if no visual cue is set
  return null;
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
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
    padding: 16,
    boxShadow: "0px 4px 10px rgba(0,0,0,0.06)",
    elevation: 3
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 8
  },
  modernStatsCard: {
    borderRadius: 20,
    borderWidth: 0,
    padding: 16,
    paddingTop: 20,
    elevation: 4,
    boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
    overflow: "hidden",
    position: "relative"
  },
  modernStatsCardCompact: {
    padding: 12,
    paddingTop: 16,
    borderRadius: 18
  },
  modernStatsCardLarge: {
    padding: 18,
    paddingTop: 22
  },
  statsCardTopAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.85
  },
  homeHeaderWrap: {
    paddingTop: 4,
    paddingBottom: 4
  },
  heroBanner: {
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    paddingLeft: 22,
    overflow: "hidden",
    position: "relative",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.07)",
    elevation: 3
  },
  heroBannerAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  heroBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  heroBannerCopy: {
    flex: 1,
    minWidth: 0
  },
  heroBannerEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6
  },
  heroBannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 4,
    letterSpacing: -0.2
  },
  heroBannerSubtitle: {
    fontSize: 13,
    color: MUTED
  },
  heroRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  heroRingInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  heroRingValue: {
    fontSize: 18,
    fontWeight: "800"
  },
  heroRingLabel: {
    fontSize: 10,
    color: MUTED,
    marginTop: 1,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 14
  },
  heroProgressFill: {
    height: "100%",
    borderRadius: 6
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1
  },
  filterChipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 3,
    borderRadius: 14
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600"
  },
  filterChipTextCompact: {
    fontSize: 11,
    fontWeight: "600"
  },
  filterChipCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChipCountCompact: {
    minWidth: 18,
    paddingHorizontal: 4,
    height: 14,
    borderRadius: 7
  },
  filterChipCountText: {
    fontSize: 11,
    fontWeight: "700"
  },
  filterChipCountTextCompact: {
    fontSize: 10,
    fontWeight: "700"
  },
  statsHeroCard: {
    borderRadius: 24,
    borderWidth: 0,
    marginHorizontal: 8,
    marginBottom: 20,
    padding: 24,
    paddingLeft: 24,
    overflow: "hidden",
    position: "relative",
    boxShadow: "0px 6px 16px rgba(0,0,0,0.3)",
    elevation: 6
  },
  statsHeroAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 0
  },
  statsHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  statsHeroCopy: {
    flex: 1,
    minWidth: 0
  },
  statsHeroEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    opacity: 0.9
  },
  statsHeroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 6,
    letterSpacing: -0.5
  },
  statsHeroSubtitle: {
    fontSize: 14,
    color: MUTED,
    fontWeight: "500",
    opacity: 0.85
  },
  statsHeroRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  statsHeroRingValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  statsHeroProgressTrack: {
    height: 10,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 20
  },
  statsHeroProgressFill: {
    height: "100%",
    borderRadius: 8
  },
  statsHeroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)"
  },
  statsHeroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statsHeroMetaText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: "600"
  },
  settingsCardList: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4
  },
  settingsRowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    boxShadow: "0px 2px 6px rgba(0,0,0,0.05)",
    elevation: 2
  },
  settingsRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT,
    marginBottom: 2
  },
  settingsRowSubtitle: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18
  },
  statsCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0
  },
  statsCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  statsCardContent: {
    flex: 1,
    minWidth: 0
  },
  modernStatsTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    color: TEXT,
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  modernStatsValue: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -0.5
  },
  modernStatsSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 6,
    lineHeight: 16
  },
  statsDoubleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  statsMiniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  statsMiniBadgeText: {
    fontSize: 10,
    fontWeight: "700"
  },
  modernProgressBar: {
    borderRadius: 4,
    height: 6,
    overflow: "hidden",
    marginTop: 6
  },
  modernProgressFill: {
    height: "100%",
    borderRadius: 4
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
  modernTaskCard: {
    borderRadius: 22,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 18,
    paddingLeft: 22,
    elevation: 4,
    boxShadow: "0px 4px 10px rgba(0,0,0,0.09)",
    overflow: "hidden",
    position: "relative"
  },
  modernTaskCardCompact: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    paddingLeft: 18,
    borderRadius: 18
  },
  modernTaskAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22
  },
  modernTaskHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingRight: 56
  },
  modernTaskIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  modernTaskTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    gap: 4,
    marginRight: 8
  },
  modernTaskTimeText: {
    fontSize: 12,
    fontWeight: "600"
  },
  modernPriorityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  modernTaskBody: {
    marginBottom: 12
  },
  modernTaskTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    color: TEXT
  },
  taskCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6
  },
  modernTaskDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    marginBottom: 8
  },
  modernTaskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modernTaskCountdown: {
    fontSize: 12,
    fontWeight: "500"
  },
  modernTaskActions: {
    flexDirection: "row",
    gap: 4
  },
  modernTaskToggle: {
    position: "absolute",
    top: 16,
    right: 16
  },
  tableTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    marginHorizontal: 8,
    marginVertical: 3,
    paddingHorizontal: 12,
    paddingVertical: 12,
    elevation: 2,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.04)"
  },
  tableTaskRowCompact: {
    marginHorizontal: 6,
    marginVertical: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12
  },
  tableTaskLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    minWidth: 0
  },
  tableTaskIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  tableTaskInfo: {
    flex: 1,
    minWidth: 0
  },
  tableTaskTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
    marginBottom: 2
  },
  tableTaskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  tableTaskTime: {
    fontSize: 11,
    fontWeight: "600"
  },
  tableMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6
  },
  tableMetaBadgeText: {
    fontSize: 10,
    fontWeight: "600"
  },
  tableTaskBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6
  },
  tableTaskDate: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "500",
    marginTop: 2
  },
  tableTaskDesc: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    lineHeight: 16,
    minWidth: 0
  },
  tableTaskRight: {
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 8
  },
  tableTaskCountdown: {
    fontSize: 10,
    fontWeight: "500"
  },
  tableTaskActions: {
    flexDirection: "row",
    gap: 4
  },
  tableActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.03)"
  },
  tableCompleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1.5
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
  attachImageButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    width: "100%",
    gap: 8
  },
  attachImageText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8
  },
  visualOptionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8
  },
  visualOptionText: {
    fontSize: 16,
    fontWeight: "500"
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
  modernAccountCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 4,
    boxShadow: "0px 4px 12px rgba(0,0,0,0.08)",
    overflow: "hidden",
    position: "relative"
  },
  accountTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    opacity: 1
  },
  accountAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 2
  },
  accountInfo: {
    flex: 1
  },
  accountName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    color: TEXT
  },
  accountEmail: {
    fontSize: 14,
    color: MUTED
  },
  accountStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4
  },
  accountStatusText: {
    fontSize: 12,
    fontWeight: "600"
  },
  modernAuthCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 3,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)"
  },
  authHeader: {
    alignItems: "center",
    marginBottom: 20
  },
  authTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
    color: TEXT
  },
  authSubtitle: {
    fontSize: 14,
    textAlign: "center",
    color: MUTED
  },
  authInput: {
    borderRadius: 12,
    marginBottom: 12
  },
  authActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8
  },
  authButton: {
    flex: 1,
    borderRadius: 12
  },
  syncStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 16
  },
  syncStatItem: {
    alignItems: "center"
  },
  syncStatValue: {
    fontSize: 28,
    fontWeight: "700"
  },
  syncStatLabel: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4
  },
  syncProgressContainer: {
    borderRadius: 8,
    height: 8,
    marginBottom: 16,
    overflow: "hidden"
  },
  syncProgressBar: {
    height: "100%",
    borderRadius: 8
  },
  syncButton: {
    borderRadius: 12,
    marginBottom: 8
  },
  signOutButton: {
    borderRadius: 12
  },
  modernSyncListCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 3,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)"
  },
  syncListTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: TEXT
  },
  syncListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  syncListItemText: {
    flex: 1,
    fontSize: 14,
    color: MUTED,
    marginRight: 8
  },
  syncListBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  syncListBadgeText: {
    fontSize: 12,
    fontWeight: "600"
  },
  deviceContent: {
    padding: 16,
    paddingBottom: 96
  },
  deviceContentCompact: {
    padding: 12,
    paddingBottom: 80
  },
  deviceHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
    marginBottom: 12,
    padding: 14,
    paddingLeft: 18,
    overflow: "hidden",
    position: "relative",
    boxShadow: "0px 3px 8px rgba(0,0,0,0.06)",
    elevation: 3
  },
  deviceHeroAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3
  },
  deviceHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  deviceHeroCopy: {
    flex: 1,
    minWidth: 0
  },
  deviceHeroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4
  },
  deviceHeroTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 8,
    letterSpacing: -0.2
  },
  deviceHeroChipsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap"
  },
  deviceHeroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10
  },
  deviceHeroChipText: {
    fontSize: 10,
    fontWeight: "600"
  },
  deviceHeroRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center"
  },
  deviceHeroRingValue: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 1
  },
  deviceRowsList: {
    gap: 8,
    marginBottom: 12
  },
  deviceRowCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    boxShadow: "0px 1px 4px rgba(0,0,0,0.04)",
    elevation: 1
  },
  deviceRowAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2.5
  },
  deviceRowMain: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    paddingLeft: 14,
    gap: 8
  },
  deviceRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  deviceRowCopy: {
    flex: 1,
    minWidth: 0
  },
  deviceRowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT,
    marginBottom: 1
  },
  deviceRowValue: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 1
  },
  deviceRowSubtitle: {
    fontSize: 10,
    color: MUTED
  },
  deviceRowActions: {
    flexDirection: "row",
    gap: 4
  },
  deviceIconButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  deviceMapContainer: {
    width: "100%",
    height: 120,
    overflow: "hidden"
  },
  deviceMap: {
    width: "100%",
    height: "100%"
  },
  sensorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    boxShadow: "0px 1px 4px rgba(0,0,0,0.04)",
    elevation: 1
  },
  sensorCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  sensorItem: {
    borderRadius: 10,
    padding: 8
  },
  sensorItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  sensorItemLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT,
    flex: 1
  },
  sensorReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  sensorReadBtnText: {
    fontSize: 10,
    fontWeight: "600"
  },
  sensorAxisText: {
    fontSize: 10,
    color: MUTED,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    paddingLeft: 24
  },
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    boxShadow: "0px 1px 4px rgba(0,0,0,0.04)",
    elevation: 1
  },
  securityBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  securityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  securityPillText: {
    fontSize: 10,
    fontWeight: "700"
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

