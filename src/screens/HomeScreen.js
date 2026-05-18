import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Animatable from "react-native-animatable";
// expo-haptics adds native tactile feedback to completion, toggle, and delete actions.
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
// expo-notifications schedules real local notifications when reminder time arrives.
import * as Notifications from "expo-notifications";
// Native date/time picker is kept as an escape hatch beside the custom Material-style picker.
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { format, formatDistanceStrict, isValid, parse, parseISO, set } from "date-fns";
import { Calendar } from "react-native-calendars";
import { Button, Divider, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { useReminders } from "../hooks/useReminders";

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
const REMINDER_CHANNEL_ID = "vizminder-reminders";

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
  "🔔",
  "🔑",
  "🔥",
  "🧥",
  "💊",
  "👟",
  "📚",
  "🧘",
  "💧",
  "🍎",
  "☕",
  "🪥",
  "🗑️",
  "✉️",
  "📱",
  "🛒",
  "🏠",
  "💼",
  "✅",
  "🏃",
  "🛏️",
  "🚗",
  "☂️",
  "💡"
];

function createDraftReminder() {
  return {
    id: `draft-${Date.now()}`,
    title: "",
    description: "",
    visualCue: "Photo or icon cue",
    visualType: "icon",
    icon: "bell-outline",
    emoji: "🔔",
    scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    timeSet: false,
    hasDate: false,
    repeat: false,
    important: true,
    completed: false,
    imageUri: null,
    streak: 0
  };
}

export default function HomeScreen() {
  const { reminders, markedDates, completeReminder, updateReminder, addReminder, deleteReminder, resetPrototype } = useReminders();
  const confettiRef = useRef(null);
  const remindersRef = useRef(reminders);
  const [tab, setTab] = useState("home");
  const [editing, setEditing] = useState(null);
  const [editMode, setEditMode] = useState("edit");
  const [reminding, setReminding] = useState(null);
  const [message, setMessage] = useState("");

  const firstReminder = reminders[0];
  const activeReminder = reminding || firstReminder;
  const completedCount = useMemo(() => reminders.filter((item) => item.completed).length, [reminders]);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    configureNotificationChannel().catch(() => {});

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

  const handleComplete = (reminder) => {
    if (reminder.notificationId) {
      Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
    }
    completeReminder(reminder.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reminder.important) {
      confettiRef.current?.start();
    }
    setReminding(null);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Photo permission is needed to attach visual cues.");
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72
    });

    return !result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {reminding ? (
          <ReminderPrompt reminder={activeReminder} onNo={() => setReminding(null)} onYes={() => handleComplete(activeReminder)} />
        ) : editing ? (
          <TaskEditScreen
            reminder={editing}
            mode={editMode}
            onUpdate={(patch) => {
              setEditing((current) => ({ ...current, ...patch }));
            }}
            onAttachImage={async () => {
              const imageUri = await pickImage();
              if (!imageUri) {
                return;
              }
              setEditing((current) => ({ ...current, imageUri }));
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
                  description: editing.description.trim()
                };
                const notificationId = await scheduleReminderNotification(reminder);
                addReminder({ ...reminder, notificationId });
                setMessage(notificationId ? "Reminder saved and notification scheduled." : "Reminder saved. Notification permission is needed for alerts.");
              } else {
                if (editing.notificationId) {
                  await Notifications.cancelScheduledNotificationAsync(editing.notificationId).catch(() => {});
                }
                const notificationId = await scheduleReminderNotification(editing);
                updateReminder(editing.id, {
                  ...editing,
                  title: editing.title.trim(),
                  description: editing.description.trim(),
                  notificationId
                });
                setMessage(notificationId ? "Reminder updated and notification scheduled." : "Reminder updated. Notification permission is needed for alerts.");
              }
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={
              editMode === "edit"
                ? () => {
                    if (editing.notificationId) {
                      Notifications.cancelScheduledNotificationAsync(editing.notificationId).catch(() => {});
                    }
                    deleteReminder(editing.id);
                    setEditing(null);
                    setMessage("Reminder deleted.");
                  }
                : null
            }
          />
        ) : (
          <>
            <Animatable.View key={tab} animation="fadeIn" duration={220} style={styles.flex} useNativeDriver>
              {tab === "home" ? (
                <HomeTab
                  reminders={reminders}
                  markedDates={markedDates}
                  onTestReminder={setReminding}
                  onEdit={(reminder) => {
                    setEditMode("edit");
                    setEditing({ ...reminder });
                  }}
                  onToggle={async (reminder, completed) =>
                    {
                      Haptics.selectionAsync().catch(() => {});
                      if (reminder.notificationId) {
                        await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
                      }
                      const notificationId = completed ? null : await scheduleReminderNotification({ ...reminder, completed: false });
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
                    if (reminder.notificationId) {
                      Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
                    }
                    deleteReminder(reminder.id);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                    setMessage("Reminder deleted.");
                  }}
                />
              ) : tab === "schedule" ? (
                <ScheduleTab
                  markedDates={markedDates}
                  reminders={reminders}
                  onEdit={(reminder) => {
                    setEditMode("edit");
                    setEditing({ ...reminder });
                  }}
                />
              ) : tab === "account" ? (
                <AccountTab completedCount={completedCount} />
              ) : (
                <SettingsTab
                  onReset={() => {
                    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
                    resetPrototype();
                    setMessage("Reminder data reset.");
                  }}
                  onMessage={setMessage}
                />
              )}
            </Animatable.View>
            <BottomNav active={tab} onChange={setTab} />
          </>
        )}
      </KeyboardAvoidingView>

      <ConfettiCannon ref={confettiRef} count={80} origin={{ x: -10, y: 0 }} autoStart={false} fadeOut />
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage("")} duration={3200}>
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

function ScreenTitle({ children, action }) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.screenTitle}>{children}</Text>
      {action ? <View style={styles.titleAction}>{action}</View> : null}
    </View>
  );
}

function HomeTab({ reminders, markedDates, onTestReminder, onEdit, onToggle, onAdd, onDelete }) {
  const [query, setQuery] = useState("");
  const visibleReminders = reminders.filter((reminder) => {
    const haystack = `${reminder.title} ${reminder.description || ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <View style={styles.screen}>
      <ScreenTitle>Home</ScreenTitle>
      <ScrollView style={styles.flex} contentContainerStyle={styles.homeList}>
        {!visibleReminders.length ? (
          <View style={styles.emptyHome}>
            <View style={styles.emptyVisual}>
              <MaterialCommunityIcons name="bell-plus-outline" size={42} color={PURPLE} />
            </View>
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.emptyText}>Use the add button below to create your first visual reminder.</Text>
          </View>
        ) : null}
        {visibleReminders.map((reminder, index) => (
          <Animatable.View key={reminder.id} animation="fadeInUp" delay={index * 70} duration={320} useNativeDriver>
            {/* react-native-gesture-handler gives this list a native-feeling swipe delete gesture. */}
            <Swipeable
              overshootRight={false}
              renderRightActions={() => (
                <SwipeDeleteAction
                  onPress={() => onDelete(reminder)}
                />
              )}
            >
            <Pressable style={styles.taskRow} onPress={() => onEdit(reminder)}>
              <View style={styles.visualBubble}>
                <VisualCue reminder={reminder} size={44} iconSize={22} compact />
              </View>
              <View style={styles.taskCopy}>
                <Text style={styles.taskTime}>
                  {format(parseISO(reminder.scheduledAt), "h:mm a")} · {getCountdownLabel(reminder.scheduledAt)}
                </Text>
                <Text style={styles.taskTitle}>{reminder.title}</Text>
                {reminder.description ? <Text style={styles.taskDescription}>{reminder.description}</Text> : null}
              </View>
              <View style={styles.taskActions}>
                <Pressable style={styles.testButton} onPress={() => onTestReminder(reminder)}>
                  <MaterialCommunityIcons name="play-circle-outline" size={22} color={PURPLE} />
                </Pressable>
                <Switch value={reminder.completed} color={PURPLE} onValueChange={(value) => onToggle(reminder, value)} />
              </View>
            </Pressable>
            </Swipeable>
          </Animatable.View>
        ))}

      </ScrollView>
      <View style={styles.searchDock}>
        <MaterialCommunityIcons name="magnify" size={22} color={MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          mode="flat"
          dense
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          style={styles.searchDockInput}
        />
        <Pressable style={styles.addButton} onPress={onAdd}>
          <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function ScheduleTab({ markedDates, reminders, onEdit }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const selectedReminders = reminders.filter(
    (reminder) => reminder.hasDate !== false && format(parseISO(reminder.scheduledAt), "yyyy-MM-dd") === selectedDate
  );
  const selectedMarkedDates = {
    ...markedDates,
    [selectedDate]: {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: PURPLE,
      selectedTextColor: "#FFFFFF"
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenTitle>Schedule</ScreenTitle>
      <ScrollView contentContainerStyle={styles.scheduleContent}>
        <View style={styles.materialCard}>
          <Text style={styles.sectionTitle}>Month task distribution</Text>
          <Calendar
            markedDates={selectedMarkedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            theme={{
              calendarBackground: SURFACE,
              selectedDayBackgroundColor: PURPLE,
              todayTextColor: PURPLE,
              arrowColor: PURPLE,
              textDayFontSize: 12,
              textMonthFontSize: 14,
              textDayHeaderFontSize: 11
            }}
          />
        </View>
        <View style={styles.materialCard}>
          <Text style={styles.sectionTitle}>{format(parseISO(selectedDate), DATE_DISPLAY_FORMAT)} reminders</Text>
          {selectedReminders.length ? (
            selectedReminders.map((reminder) => (
              <Pressable key={reminder.id} style={styles.scheduleRow} onPress={() => onEdit(reminder)}>
                <VisualCue reminder={reminder} size={44} iconSize={22} compact />
                <View style={styles.scheduleCopy}>
                  <Text style={styles.taskTitle}>{reminder.title}</Text>
                  <Text style={styles.taskTime}>
                    {format(parseISO(reminder.scheduledAt), "h:mm a")} · {getCountdownLabel(reminder.scheduledAt)}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={MUTED} />
              </Pressable>
            ))
          ) : (
            <View style={styles.emptySchedule}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={MUTED} />
              <Text style={styles.emptyText}>No reminders on this date.</Text>
            </View>
          )}
        </View>
      </ScrollView>
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

function ReminderPrompt({ reminder, onNo, onYes }) {
  return (
    <Animatable.View animation="fadeInUp" duration={260} style={styles.reminderScreen} useNativeDriver>
      <ScreenTitle>VizMinder</ScreenTitle>
      <VisualCue reminder={reminder} size={104} iconSize={48} />
      <View style={styles.reminderCopy}>
        <Text style={styles.reminderHeadline}>It is {format(parseISO(reminder.scheduledAt), "hh:mm")} now !</Text>
        <Text style={styles.reminderQuestion}>Have you bring you key?</Text>
      </View>
      <View style={styles.answerRow}>
        <Pressable style={[styles.answerButton, styles.answerNo]} onPress={onNo}>
          <MaterialCommunityIcons name="close" size={38} color="#FFFFFF" />
        </Pressable>
        <Pressable style={[styles.answerButton, styles.answerYes]} onPress={onYes}>
          <MaterialCommunityIcons name="check" size={38} color="#FFFFFF" />
        </Pressable>
      </View>
    </Animatable.View>
  );
}

function TaskEditScreen({ reminder, mode, onUpdate, onAttachImage, onSave, onCancel, onDelete }) {
  const [timeOpen, setTimeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <Animatable.View animation="fadeInUp" duration={240} style={styles.screen} useNativeDriver>
      <ScreenTitle>{mode === "add" ? "Add Task" : "Edit Task"}</ScreenTitle>
      <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
        <View style={styles.imageEditWrap}>
          <VisualCue reminder={reminder} size={104} iconSize={48} />
          <Pressable style={styles.editFab} onPress={onAttachImage}>
            <MaterialCommunityIcons name="pencil" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <VisualSourcePicker reminder={reminder} onUpdate={onUpdate} onAttachImage={onAttachImage} />

        <EditTextField label="Title" value={reminder.title} onChangeText={(title) => onUpdate({ title })} />
        <EditTextField
          label="Description (optional)"
          value={reminder.description}
          onChangeText={(description) => onUpdate({ description })}
          multiline
        />
        <EditField
          label="Time"
          value={reminder.timeSet === false ? "Required" : format(parseISO(reminder.scheduledAt), "HH:mm")}
          onPress={() => setTimeOpen(true)}
          onClear={() => onUpdate({ timeSet: false })}
        />
        <EditField
          label="Date"
          value={reminder.hasDate === false ? "Optional" : format(parseISO(reminder.scheduledAt), DATE_DISPLAY_FORMAT)}
          onPress={() => setDateOpen(true)}
          onClear={() => onUpdate({ hasDate: false })}
        />
        <View style={styles.importantRow}>
          <View>
            <Text style={styles.editLabel}>Important reminder</Text>
            <Text style={styles.importantHelp}>Yes triggers celebration when completed.</Text>
          </View>
          <Switch value={Boolean(reminder.important)} color={PURPLE} onValueChange={(important) => onUpdate({ important })} />
        </View>

        <View style={styles.formActions}>
          {onDelete ? (
            <Button mode="text" icon="delete-outline" textColor={ERROR} style={styles.deleteButton} onPress={onDelete}>
              Delete
            </Button>
          ) : null}
          <Button mode="contained" buttonColor={PURPLE} textColor="#FFFFFF" style={styles.actionButton} onPress={onSave}>
            Save
          </Button>
          <Button mode="outlined" textColor={MUTED} style={styles.actionButton} onPress={onCancel}>
            Cancel
          </Button>
        </View>
      </ScrollView>

      <TimeDialog
        visible={timeOpen}
        value={reminder.scheduledAt}
        onConfirm={(nextDate) => onUpdate({ scheduledAt: nextDate.toISOString(), timeSet: true })}
        onDismiss={() => setTimeOpen(false)}
      />
      <DateDialog
        visible={dateOpen}
        value={reminder.scheduledAt}
        hasDate={reminder.hasDate !== false}
        repeat={Boolean(reminder.repeat)}
        onConfirm={(nextDate, repeat) => onUpdate({ scheduledAt: nextDate.toISOString(), hasDate: true, repeat })}
        onDismiss={() => setDateOpen(false)}
      />
    </Animatable.View>
  );
}

function EditField({ label, value, onPress, onClear }) {
  return (
    <Pressable style={styles.editField} onPress={onPress}>
      <Text style={styles.editLabel}>{label}</Text>
      <View style={styles.editValue}>
        <Text style={styles.editValueText}>{value}</Text>
        <Pressable
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            onClear?.();
          }}
        >
          <MaterialCommunityIcons name="close-circle-outline" size={24} color="#56515E" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function EditTextField({ label, value, onChangeText, multiline = false }) {
  return (
    <View style={[styles.editTextField, multiline && styles.editTextFieldTall]}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        mode="flat"
        dense
        multiline={multiline}
        placeholder={label.startsWith("Description") ? "Optional" : "Required"}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        style={[styles.editTextInput, multiline && styles.editTextInputTall]}
      />
    </View>
  );
}

function AccountTab({ completedCount }) {
  return (
    <View style={styles.screen}>
      <ScreenTitle>Account</ScreenTitle>
      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account-outline" size={36} color={PURPLE} />
        </View>
        <View>
          <Text style={styles.accountName}>User</Text>
          <Text style={styles.accountPlan}>Free Plan</Text>
        </View>
      </View>
      <View style={styles.planBlock}>
        <Text style={styles.planTitle}>Plan</Text>
        <Text style={styles.planCopy}>Upgrade for more Feature!</Text>
        <Text style={styles.planCopy}>Completed reminders: {completedCount}</Text>
        <View style={styles.planActions}>
          <Button mode="outlined" textColor="#4E4956" style={styles.planButton}>
            Dismiss
          </Button>
          <Button mode="contained" icon="star-circle" buttonColor={PURPLE} style={styles.planButton}>
            Upgrade
          </Button>
        </View>
      </View>
    </View>
  );
}

function SettingsTab({ onReset, onMessage }) {
  const items = [
    ["message-outline", "Notification", "Grant permission\nChange notification type.", () => onMessage("Notification permission prototype.")],
    ["swap-vertical", "Sync Data", "Back up reminders and visual cues.", () => onMessage("Reminder sync queued.")],
    ["shield-lock-outline", "Privacy", "Review local storage and image access.", () => onMessage("Reminder data stays local unless cloud sync is configured.")],
    ["restart", "Reset Reminders", "Restore sample reminders.", onReset]
  ];

  return (
    <View style={styles.screen}>
      <ScreenTitle>Settings</ScreenTitle>
      <View style={styles.settingsList}>
        {items.map(([icon, title, copy, action]) => (
          <Pressable key={title} onPress={action}>
            <View style={styles.settingsRow}>
              <MaterialCommunityIcons name={icon} size={24} color="#4E4956" />
              <View style={styles.settingsCopy}>
                <Text style={styles.settingsTitle}>{title}</Text>
                <Text style={styles.settingsDescription}>{copy}</Text>
              </View>
            </View>
            <Divider style={styles.settingsDivider} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BottomNav({ active, onChange }) {
  const tabs = [
    ["home", "bell-outline", "Home"],
    ["schedule", "calendar-month-outline", "Schedule"],
    ["account", "account-circle-outline", "Account"],
    ["settings", "cog-outline", "Settings"]
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map(([key, icon, label]) => (
        <Pressable key={key} style={styles.navItem} onPress={() => onChange(key)}>
          <View style={[styles.navIconWrap, active === key && styles.navIconActive]}>
            <View style={styles.navIconAnchor}>
              <MaterialCommunityIcons name={icon} size={24} color="#4E4956" />
              {key === "home" ? <View style={styles.notificationDot} /> : null}
            </View>
          </View>
          <Text style={styles.navLabel}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function VisualCue({ reminder, size, iconSize, compact = false }) {
  const visualType = reminder.visualType || (reminder.imageUri ? "image" : "icon");
  if (visualType === "image" && reminder.imageUri) {
    return <Image source={{ uri: reminder.imageUri }} style={[styles.imagePlaceholder, { height: size, width: size }]} />;
  }

  if (visualType === "emoji") {
    const isCompact = compact || size <= 48;
    return (
      <View style={[isCompact ? styles.compactEmojiCueWrap : styles.imagePlaceholder, { height: size, width: size }]}>
        <Text
          style={[
            styles.emojiCue,
            isCompact && styles.compactEmojiCue,
            isCompact
              ? { fontSize: iconSize, height: size, lineHeight: size, width: size }
              : { fontSize: iconSize, lineHeight: iconSize + 10 }
          ]}
        >
          {reminder.emoji || "🔔"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.imagePlaceholder, { height: size, width: size }]}>
      <MaterialCommunityIcons name={reminder.icon || "bell-outline"} size={iconSize} color={PURPLE} />
    </View>
  );
}

function VisualSourcePicker({ reminder, onUpdate, onAttachImage }) {
  const visualType = reminder.visualType || (reminder.imageUri ? "image" : "icon");
  return (
    <View style={styles.visualPicker}>
      <View style={styles.visualTabs}>
        {[
          ["image", "image-outline", "Photo"],
          ["icon", "shape-outline", "Icon"],
          ["emoji", "emoticon-outline", "Emoji"]
        ].map(([type, icon, label]) => (
          <Pressable
            key={type}
            style={[styles.visualTab, visualType === type && styles.visualTabActive]}
            onPress={() => {
              if (type === "image") {
                onAttachImage();
              }
              onUpdate({ visualType: type });
            }}
          >
            <MaterialCommunityIcons name={icon} size={18} color={visualType === type ? "#FFFFFF" : PURPLE} />
            <Text style={[styles.visualTabText, visualType === type && styles.visualTabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {visualType === "icon" ? (
        <View style={styles.choiceGrid}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              style={[styles.visualChoice, reminder.icon === icon && styles.visualChoiceActive]}
              onPress={() => onUpdate({ visualType: "icon", icon })}
            >
              <MaterialCommunityIcons name={icon} size={24} color={reminder.icon === icon ? "#FFFFFF" : PURPLE} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {visualType === "emoji" ? (
        <View style={styles.choiceGrid}>
          {EMOJI_OPTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[styles.visualChoice, reminder.emoji === emoji && styles.visualChoiceActive]}
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

function TimeDialog({ visible, value, onConfirm, onDismiss }) {
  const baseDate = parseISO(value);
  const [hour, setHour] = useState(format(baseDate, "HH"));
  const [minute, setMinute] = useState(format(baseDate, "mm"));
  const [clockMode, setClockMode] = useState(false);
  const [nativeTimeOpen, setNativeTimeOpen] = useState(false);
  const apply = () => {
    const next = set(baseDate, {
      hours: clampNumber(hour, 0, 23),
      minutes: clampNumber(minute, 0, 59),
      seconds: 0,
      milliseconds: 0
    });
    onConfirm(next);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <BlurLayer>
        <View style={styles.timeDialog}>
          <Text style={styles.dialogLabel}>Enter time</Text>
          {clockMode ? (
            <ClockPicker hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />
          ) : (
            <>
              <View style={styles.timeInputs}>
                <TextInput
                  mode="outlined"
                  value={hour}
                  onChangeText={(text) => setHour(text.replace(/\D/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  outlineColor={PURPLE}
                  activeOutlineColor={PURPLE}
                  style={styles.timeInput}
                  textColor={PURPLE}
                />
                <Text style={styles.colon}>:</Text>
                <TextInput
                  mode="outlined"
                  value={minute}
                  onChangeText={(text) => setMinute(text.replace(/\D/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  outlineColor="#E6E0E8"
                  activeOutlineColor={PURPLE}
                  style={styles.timeInput}
                  textColor={TEXT}
                />
              </View>
              <View style={styles.timeLabels}>
                <Text style={styles.inputHelp}>Hour</Text>
                <Text style={styles.inputHelp}>Minute</Text>
              </View>
            </>
          )}
          <View style={styles.dialogActions}>
            <View style={styles.dialogIconGroup}>
              <Pressable style={styles.dialogIconButton} onPress={() => setClockMode((value) => !value)}>
                <MaterialCommunityIcons name={clockMode ? "keyboard-outline" : "clock"} size={28} color="#56515E" />
              </Pressable>
              <Pressable style={styles.dialogIconButton} onPress={() => setNativeTimeOpen(true)}>
                <MaterialCommunityIcons name="cellphone-cog" size={24} color="#56515E" />
              </Pressable>
            </View>
            <View style={styles.dialogButtonRow}>
              <Button textColor={PURPLE} onPress={onDismiss}>
                Cancel
              </Button>
              <Button textColor={PURPLE} onPress={apply}>
                OK
              </Button>
            </View>
          </View>
          {nativeTimeOpen ? (
            <DateTimePicker
              value={set(baseDate, { hours: clampNumber(hour, 0, 23), minutes: clampNumber(minute, 0, 59) })}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setNativeTimeOpen(Platform.OS === "ios");
                if (selectedDate) {
                  setHour(format(selectedDate, "HH"));
                  setMinute(format(selectedDate, "mm"));
                }
              }}
            />
          ) : null}
        </View>
      </BlurLayer>
    </Modal>
  );
}

function DateDialog({ visible, value, hasDate, repeat, onConfirm, onDismiss }) {
  const initialDate = parseISO(value);
  const [selected, setSelected] = useState(format(initialDate, "yyyy-MM-dd"));
  const [dateText, setDateText] = useState(hasDate ? format(initialDate, DATE_DISPLAY_FORMAT) : "");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(repeat);
  const [nativeDateOpen, setNativeDateOpen] = useState(false);
  const apply = () => {
    const current = parseISO(value);
    const day = parseDateInput(dateText) || parseISO(selected);
    const next = set(day, {
      hours: current.getHours(),
      minutes: current.getMinutes(),
      seconds: 0,
      milliseconds: 0
    });
    onConfirm(next, repeatEnabled);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <BlurLayer>
        <View style={styles.dateDialog}>
          <Text style={styles.dateDialogTitle}>Select date</Text>
          <View style={styles.dateHeader}>
            <TextInput
              label="Enter date"
              value={dateText}
              onChangeText={setDateText}
              placeholder={DATE_INPUT_PLACEHOLDER}
              mode="outlined"
              dense
              style={styles.dateTextInput}
            />
            <Pressable
              style={styles.dialogIconButton}
              onPress={() => setCalendarOpen((value) => !value)}
            >
              <MaterialCommunityIcons name="calendar" size={28} color="#56515E" />
            </Pressable>
            <Pressable
              style={styles.dialogIconButton}
              onPress={() => setNativeDateOpen(true)}
            >
              <MaterialCommunityIcons name="cellphone-cog" size={24} color="#56515E" />
            </Pressable>
          </View>
          <Divider />
          {calendarOpen ? <View style={styles.dialogCalendar}>
            <Calendar
              current={selected}
              markedDates={{
                [selected]: { selected: true, selectedColor: PURPLE }
              }}
              onDayPress={(day) => {
                setSelected(day.dateString);
                setDateText(day.dateString.replaceAll("-", "/"));
                setCalendarOpen(false);
              }}
              theme={{
                calendarBackground: "#EEE8F0",
                selectedDayBackgroundColor: PURPLE,
                todayTextColor: PURPLE,
                arrowColor: PURPLE,
                textDayFontSize: 12,
                textMonthFontSize: 14,
                textDayHeaderFontSize: 11
              }}
            />
          </View> : null}
          <View style={styles.dateActions}>
            <Text style={styles.repeatText}>Repeat</Text>
            <Switch value={repeatEnabled} color={PURPLE} onValueChange={setRepeatEnabled} />
            <Button textColor={PURPLE} onPress={onDismiss}>
              Cancel
            </Button>
            <Button textColor={PURPLE} onPress={apply}>
              OK
            </Button>
          </View>
          {nativeDateOpen ? (
            <DateTimePicker
              value={parseDateInput(dateText) || parseISO(selected)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(event, selectedDate) => {
                setNativeDateOpen(Platform.OS === "ios");
                if (selectedDate) {
                  const valueText = format(selectedDate, DATE_DISPLAY_FORMAT);
                  setSelected(format(selectedDate, "yyyy-MM-dd"));
                  setDateText(valueText);
                }
              }}
            />
          ) : null}
        </View>
      </BlurLayer>
    </Modal>
  );
}

function ClockPicker({ hour, minute, onHour, onMinute }) {
  const hours = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
  const minutes = Array.from({ length: 12 }, (_, index) => `${index * 5}`.padStart(2, "0"));
  const [step, setStep] = useState("hour");
  const selectedHour12 = String(((clampNumber(hour, 0, 23) + 11) % 12) + 1);
  const values = step === "hour" ? hours : minutes;
  const selectedValue = step === "hour" ? selectedHour12 : minute.padStart(2, "0");

  return (
    <View style={styles.clockPicker}>
      <Text style={styles.clockStepLabel}>{step === "hour" ? "Select hour" : "Select minute"}</Text>
      <View style={styles.clockReadout}>
        <Pressable style={[styles.clockReadoutSegment, step === "hour" && styles.clockReadoutSegmentActive]} onPress={() => setStep("hour")}>
          <Text style={[styles.clockReadoutText, step === "hour" && styles.clockReadoutTextActive]}>{hour.padStart(2, "0")}</Text>
        </Pressable>
        <Text style={styles.clockReadoutColon}>:</Text>
        <Pressable style={[styles.clockReadoutSegment, step === "minute" && styles.clockReadoutSegmentActive]} onPress={() => setStep("minute")}>
          <Text style={[styles.clockReadoutText, step === "minute" && styles.clockReadoutTextActive]}>{minute.padStart(2, "0")}</Text>
        </Pressable>
      </View>
      <Animatable.View key={step} animation="fadeIn" duration={160} style={styles.clockFace} useNativeDriver>
        <View style={styles.clockHand} />
        <View style={styles.clockCenter} />
        {values.map((item, index) => {
          const angle = (index + 1) * 30 - 90;
          const radius = 78;
          const left = 92 + Math.cos((angle * Math.PI) / 180) * radius - 18;
          const top = 92 + Math.sin((angle * Math.PI) / 180) * radius - 18;
          return (
          <Pressable
            key={item}
            style={[styles.clockNumber, { left, top }, selectedValue === item.padStart(2, "0") && styles.clockNumberActive]}
            onPress={() => {
              if (step === "hour") {
                onHour(item.padStart(2, "0"));
                setStep("minute");
              } else {
                onMinute(item.padStart(2, "0"));
              }
            }}
          >
            <Text style={[styles.clockNumberText, selectedValue === item.padStart(2, "0") && styles.clockNumberTextActive]}>{item}</Text>
          </Pressable>
          );
        })}
      </Animatable.View>
    </View>
  );
}

function BlurLayer({ children }) {
  return (
    <View style={styles.modalLayer}>
      <View style={styles.blurOverlay} />
      {children}
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

async function scheduleReminderNotification(reminder) {
  if (reminder.timeSet === false || reminder.completed) {
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
      body: reminder.description?.trim() || "Time to check this visual reminder.",
      sound: "default",
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

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: fireDate,
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

function parseDateInput(value) {
  const normalized = value.trim().replaceAll("-", "/");
  if (!normalized) {
    return null;
  }
  const parsed = parse(normalized, "yyyy/MM/dd", new Date());
  return isValid(parsed) ? parsed : null;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: SURFACE,
    flex: 1
  },
  flex: {
    flex: 1
  },
  screen: {
    backgroundColor: BG,
    flex: 1,
    paddingBottom: 78
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
  scheduleContent: {
    padding: 16,
    paddingBottom: 96
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
    backgroundColor: LIGHT_PURPLE,
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
    fontSize: 12,
    fontWeight: "700"
  },
  taskTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22
  },
  taskDescription: {
    color: MUTED,
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
    bottom: 78,
    flexDirection: "row",
    height: 56,
    justifyContent: "space-between",
    left: 18,
    paddingLeft: 16,
    paddingRight: 8,
    position: "absolute",
    right: 18
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
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 26,
    textAlign: "center"
  },
  reminderQuestion: {
    color: PURPLE,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center"
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
    gap: 8
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
  settingsList: {
    backgroundColor: SURFACE,
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: "hidden"
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
    height: 66,
    justifyContent: "space-around",
    left: 0,
    position: "absolute",
    right: 0
  },
  navItem: {
    alignItems: "center",
    minWidth: 78
  },
  navIconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 32,
    justifyContent: "center",
    width: 56
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
    fontSize: 12,
    fontWeight: "700"
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
