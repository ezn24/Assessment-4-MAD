package com.ezn24.vizminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.time.Instant

class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AlarmScheduler"

  // BroadcastReceiver that listens for responses from AlarmActivity (Yes / No / Confirmed)
  private val responseReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action != ACTION_ALARM_RESPONSE) return
      val reminderId = intent.getStringExtra(EXTRA_REMINDER_ID) ?: return
      val mode = intent.getStringExtra(EXTRA_ALARM_MODE) ?: return
      val params = Arguments.createMap().apply {
        putString("reminderId", reminderId)
        putString("mode", mode)           // "yes" | "no" | "confirmed"
      }
      try {
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("AlarmResponse", params)
      } catch (_: Exception) { }
    }
  }

  private var receiverRegistered = false

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN built-in event emitter; register receiver on first listener
    if (!receiverRegistered) {
      val filter = IntentFilter(ACTION_ALARM_RESPONSE)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        reactContext.registerReceiver(responseReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        reactContext.registerReceiver(responseReceiver, filter)
      }
      receiverRegistered = true
    }
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // No-op; receiver stays registered for the lifetime of the module
  }

  @ReactMethod
  fun scheduleAlarm(reminderId: String, title: String, body: String, isoTime: String, repeatDaily: Boolean, ringtone: String, visualType: String, icon: String, emoji: String, imageUri: String, repeatUntil: String, followUpRemaining: Int, followUpIntervalMinutes: Int, soundEnabled: Boolean, vibrationEnabled: Boolean, promise: Promise) {
    try {
      val fireAt = Instant.parse(isoTime).toEpochMilli()
      if (fireAt <= System.currentTimeMillis()) {
        promise.resolve(false)
        return
      }

      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      // On Android 12 (S), check canScheduleExactAlarms (USE_EXACT_ALARM auto-grants on Android 13+)
      if (Build.VERSION.SDK_INT == Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${reactContext.packageName}")
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(intent)
        promise.resolve(false)
        return
      }

      val receiverIntent = Intent(reactContext, AlarmReceiver::class.java).apply {
        action = ACTION_FIRE_ALARM
        putExtra(EXTRA_REMINDER_ID, reminderId)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
        putExtra(EXTRA_FIRE_TIME, isoTime)
        putExtra(EXTRA_REPEAT_DAILY, repeatDaily)
        putExtra(EXTRA_RINGTONE, ringtone)
        putExtra(EXTRA_VISUAL_TYPE, visualType)
        putExtra(EXTRA_ICON, icon)
        putExtra(EXTRA_EMOJI, emoji)
        putExtra(EXTRA_IMAGE_URI, imageUri)
        putExtra(EXTRA_REPEAT_UNTIL, repeatUntil)
        putExtra(EXTRA_FOLLOW_UP_REMAINING, followUpRemaining)
        putExtra(EXTRA_FOLLOW_UP_INTERVAL_MINUTES, followUpIntervalMinutes)
        putExtra(EXTRA_SOUND_ENABLED, soundEnabled)
        putExtra(EXTRA_VIBRATION_ENABLED, vibrationEnabled)
      }
      val operation = PendingIntent.getBroadcast(
        reactContext,
        requestCode(reminderId),
        receiverIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val showIntent = Intent(reactContext, AlarmActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(EXTRA_REMINDER_ID, reminderId)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
        putExtra(EXTRA_FIRE_TIME, isoTime)
        putExtra(EXTRA_REPEAT_DAILY, repeatDaily)
        putExtra(EXTRA_RINGTONE, ringtone)
        putExtra(EXTRA_VISUAL_TYPE, visualType)
        putExtra(EXTRA_ICON, icon)
        putExtra(EXTRA_EMOJI, emoji)
        putExtra(EXTRA_IMAGE_URI, imageUri)
        putExtra(EXTRA_REPEAT_UNTIL, repeatUntil)
        putExtra(EXTRA_FOLLOW_UP_REMAINING, followUpRemaining)
        putExtra(EXTRA_FOLLOW_UP_INTERVAL_MINUTES, followUpIntervalMinutes)
        putExtra(EXTRA_SOUND_ENABLED, soundEnabled)
        putExtra(EXTRA_VIBRATION_ENABLED, vibrationEnabled)
      }
      val showOperation = PendingIntent.getActivity(
        reactContext,
        requestCode("show-$reminderId"),
        showIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(fireAt, showOperation), operation)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ALARM_SCHEDULE_FAILED", error)
    }
  }

  @ReactMethod
  fun showAlarmNow(reminderId: String, title: String, body: String, isoTime: String, repeatDaily: Boolean, ringtone: String, visualType: String, icon: String, emoji: String, imageUri: String, repeatUntil: String, followUpRemaining: Int, followUpIntervalMinutes: Int, soundEnabled: Boolean, vibrationEnabled: Boolean, promise: Promise) {
    try {
      val showIntent = Intent(reactContext, AlarmActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(EXTRA_REMINDER_ID, reminderId)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
        putExtra(EXTRA_FIRE_TIME, isoTime)
        putExtra(EXTRA_REPEAT_DAILY, repeatDaily)
        putExtra(EXTRA_RINGTONE, ringtone)
        putExtra(EXTRA_VISUAL_TYPE, visualType)
        putExtra(EXTRA_ICON, icon)
        putExtra(EXTRA_EMOJI, emoji)
        putExtra(EXTRA_IMAGE_URI, imageUri)
        putExtra(EXTRA_REPEAT_UNTIL, repeatUntil)
        putExtra(EXTRA_FOLLOW_UP_REMAINING, followUpRemaining)
        putExtra(EXTRA_FOLLOW_UP_INTERVAL_MINUTES, followUpIntervalMinutes)
        putExtra(EXTRA_SOUND_ENABLED, soundEnabled)
        putExtra(EXTRA_VIBRATION_ENABLED, vibrationEnabled)
      }
      reactContext.startActivity(showIntent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ALARM_SHOW_FAILED", error)
    }
  }

  @ReactMethod
  fun cancelAlarm(reminderId: String, promise: Promise) {
    try {
      val intent = Intent(reactContext, AlarmReceiver::class.java).apply {
        action = ACTION_FIRE_ALARM
      }
      val operation = PendingIntent.getBroadcast(
        reactContext,
        requestCode(reminderId),
        intent,
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
      )
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (operation != null) {
        alarmManager.cancel(operation)
        operation.cancel()
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ALARM_CANCEL_FAILED", error)
    }
  }

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(true)
        return
      }
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      promise.resolve(alarmManager.canScheduleExactAlarms())
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestExactAlarmPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(true)
        return
      }
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (alarmManager.canScheduleExactAlarms()) {
        promise.resolve(true)
        return
      }
      // Only Android 12 (S) needs this — Android 13+ USE_EXACT_ALARM is auto-granted
      if (Build.VERSION.SDK_INT == Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${reactContext.packageName}")
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(intent)
      }
      promise.resolve(false)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun setTheme(isDark: Boolean, primaryHex: String, secondaryHex: String, backgroundHex: String, textColorHex: String, subtextColorHex: String, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences("VizminderPrefs", Context.MODE_PRIVATE)
      prefs.edit().apply {
        putBoolean("isDarkTheme", isDark)
        putString("primaryHex", primaryHex)
        putString("secondaryHex", secondaryHex)
        putString("backgroundHex", backgroundHex)
        putString("textColorHex", textColorHex)
        putString("subtextColorHex", subtextColorHex)
      }.apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("THEME_SAVE_FAILED", e)
    }
  }

  private fun requestCode(value: String): Int = value.hashCode()

  companion object {
    const val ACTION_FIRE_ALARM = "com.ezn24.vizminder.ACTION_FIRE_ALARM"
    const val ACTION_ALARM_RESPONSE = "com.ezn24.vizminder.ALARM_RESPONSE"
    const val EXTRA_REMINDER_ID = "reminderId"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_FIRE_TIME = "fireTime"
    const val EXTRA_REPEAT_DAILY = "repeatDaily"
    const val EXTRA_RINGTONE = "ringtone"
    const val EXTRA_VISUAL_TYPE = "visualType"
    const val EXTRA_ICON = "icon"
    const val EXTRA_EMOJI = "emoji"
    const val EXTRA_IMAGE_URI = "imageUri"
    const val EXTRA_REPEAT_UNTIL = "repeatUntil"
    const val EXTRA_FOLLOW_UP_REMAINING = "followUpRemaining"
    const val EXTRA_FOLLOW_UP_INTERVAL_MINUTES = "followUpIntervalMinutes"
    const val EXTRA_SOUND_ENABLED = "soundEnabled"
    const val EXTRA_VIBRATION_ENABLED = "vibrationEnabled"
    const val EXTRA_ALARM_MODE = "alarmMode"
  }
}
