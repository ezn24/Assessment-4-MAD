import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { listReminders } from "./storage";
import { isDue } from "../models/reminder";

export const REMINDER_SWEEP_TASK = "VIZMINDER_REMINDER_SWEEP";

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

export async function registerReminderSweepTask() {
  const registered = await TaskManager.isTaskRegisteredAsync(REMINDER_SWEEP_TASK);
  if (registered) {
    return true;
  }
  await BackgroundTask.registerTaskAsync(REMINDER_SWEEP_TASK, {
    minimumInterval: 15
  });
  return true;
}
