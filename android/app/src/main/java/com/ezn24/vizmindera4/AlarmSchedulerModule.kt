package com.ezn24.vizmindera4

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.time.Instant

class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AlarmScheduler"

  @ReactMethod
  fun scheduleAlarm(reminderId: String, title: String, body: String, isoTime: String, repeatDaily: Boolean, ringtone: String, promise: Promise) {
    try {
      val fireAt = Instant.parse(isoTime).toEpochMilli()
      if (fireAt <= System.currentTimeMillis()) {
        promise.resolve(false)
        return
      }

      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
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
        putExtra(EXTRA_REPEAT_DAILY, repeatDaily)
        putExtra(EXTRA_RINGTONE, ringtone)
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
        putExtra(EXTRA_REPEAT_DAILY, repeatDaily)
        putExtra(EXTRA_RINGTONE, ringtone)
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

  private fun requestCode(value: String): Int = value.hashCode()

  companion object {
    const val ACTION_FIRE_ALARM = "com.ezn24.vizmindera4.ACTION_FIRE_ALARM"
    const val EXTRA_REMINDER_ID = "reminderId"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_REPEAT_DAILY = "repeatDaily"
    const val EXTRA_RINGTONE = "ringtone"
  }
}
