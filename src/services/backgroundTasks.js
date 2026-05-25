import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { listReminders } from "./storage";
import { isDue } from "../models/reminder";

export const REMINDER_SWEEP_TASK = "VIZMINDER_REMINDER_SWEEP";

if (Platform.OS !== "web") {
  try {
    TaskManager.defineTask(REMINDER_SWEEP_TASK, async () => {
      try {
        const reminders = await listReminders();
        const dueCount = reminders.filter((item) => isDue(item)).length;
        console.log(`[VizMinder] background sweep found ${dueCount} due reminders`);
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (error) {
        console.warn("[VizMinder] background sweep failed", error);
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch (e) {
    console.warn("Failed to define TaskManager task:", e);
  }
}

export async function registerReminderSweepTask() {
  if (Platform.OS === "web") {
    return false;
  }
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(REMINDER_SWEEP_TASK);
    if (registered) {
      return true;
    }
    await BackgroundTask.registerTaskAsync(REMINDER_SWEEP_TASK, {
      minimumInterval: 15
    });
    return true;
  } catch (e) {
    console.warn("Failed to register sweep task:", e);
    return false;
  }
}
