package com.ezn24.vizmindera4

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import java.util.Calendar
import java.time.Instant
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val reminderId = intent.getStringExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID) ?: "reminder"
    val title = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TITLE) ?: "VizMinder reminder"
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: "Time to check this reminder."
    val fireTime = intent.getStringExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME) ?: ""
    val repeatDaily = intent.getBooleanExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, false)
    val ringtone = intent.getStringExtra(AlarmSchedulerModule.EXTRA_RINGTONE) ?: "alarm"
    val visualType = intent.getStringExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE) ?: "icon"
    val emoji = intent.getStringExtra(AlarmSchedulerModule.EXTRA_EMOJI) ?: "\uD83D\uDD14"
    val repeatUntil = intent.getStringExtra(AlarmSchedulerModule.EXTRA_REPEAT_UNTIL) ?: ""
    val followUpRemaining = intent.getIntExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_REMAINING, 0)
    val followUpIntervalMinutes = intent.getIntExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_INTERVAL_MINUTES, 5).coerceAtLeast(1)
    val soundEnabled = intent.getBooleanExtra(AlarmSchedulerModule.EXTRA_SOUND_ENABLED, true)
    val vibrationEnabled = intent.getBooleanExtra(AlarmSchedulerModule.EXTRA_VIBRATION_ENABLED, true)

    ensureChannel(context)

    val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_NO_USER_ACTION
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
      putExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME, fireTime)
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, repeatDaily)
      putExtra(AlarmSchedulerModule.EXTRA_RINGTONE, ringtone)
      putExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE, visualType)
      putExtra(AlarmSchedulerModule.EXTRA_EMOJI, emoji)
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_UNTIL, repeatUntil)
      putExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_REMAINING, followUpRemaining)
      putExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_INTERVAL_MINUTES, followUpIntervalMinutes)
      putExtra(AlarmSchedulerModule.EXTRA_SOUND_ENABLED, soundEnabled)
      putExtra(AlarmSchedulerModule.EXTRA_VIBRATION_ENABLED, vibrationEnabled)
    }
    val fullScreenIntent = PendingIntent.getActivity(
      context,
      reminderId.hashCode(),
      alarmIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setColor(Color.rgb(79, 55, 139))
      .setDefaults((if (soundEnabled) NotificationCompat.DEFAULT_SOUND else 0) or (if (vibrationEnabled) NotificationCompat.DEFAULT_VIBRATE else 0))
      .setVibrate(if (vibrationEnabled) longArrayOf(0, 450, 200, 450) else longArrayOf(0))
      .setSound(if (soundEnabled) Settings.System.DEFAULT_ALARM_ALERT_URI else null)
      .setFullScreenIntent(fullScreenIntent, true)
      .setContentIntent(fullScreenIntent)
      .build()

    NotificationManagerCompat.from(context).notify(reminderId.hashCode(), notification)
    wakeForAlarm(context)
    context.startActivity(alarmIntent)
    if (followUpRemaining > 0) {
      scheduleFollowUpAlarm(context, reminderId, title, body, ringtone, visualType, emoji, repeatUntil, repeatDaily, followUpRemaining - 1, followUpIntervalMinutes, soundEnabled, vibrationEnabled)
    } else if (repeatDaily && isBeforeRepeatUntil(repeatUntil)) {
      scheduleNextDailyAlarm(context, reminderId, title, body, ringtone, visualType, emoji, repeatUntil, soundEnabled, vibrationEnabled)
    }
  }

  private fun scheduleFollowUpAlarm(context: Context, reminderId: String, title: String, body: String, ringtone: String, visualType: String, emoji: String, repeatUntil: String, repeatDaily: Boolean, followUpRemaining: Int, followUpIntervalMinutes: Int, soundEnabled: Boolean, vibrationEnabled: Boolean) {
    val next = System.currentTimeMillis() + followUpIntervalMinutes * 60_000L
    scheduleAlarmAt(context, "$reminderId-follow-$followUpRemaining", reminderId, title, body, ringtone, visualType, emoji, repeatUntil, repeatDaily, followUpRemaining, followUpIntervalMinutes, next, soundEnabled, vibrationEnabled)
  }

  private fun scheduleNextDailyAlarm(context: Context, reminderId: String, title: String, body: String, ringtone: String, visualType: String, emoji: String, repeatUntil: String, soundEnabled: Boolean, vibrationEnabled: Boolean) {
    val next = Calendar.getInstance().apply {
      timeInMillis = System.currentTimeMillis()
      add(Calendar.DATE, 1)
    }.timeInMillis
    if (!isBeforeRepeatUntil(repeatUntil, next)) return
    scheduleAlarmAt(context, reminderId, reminderId, title, body, ringtone, visualType, emoji, repeatUntil, true, 0, 5, next, soundEnabled, vibrationEnabled)
  }

  private fun scheduleAlarmAt(context: Context, requestKey: String, reminderId: String, title: String, body: String, ringtone: String, visualType: String, emoji: String, repeatUntil: String, repeatDaily: Boolean, followUpRemaining: Int, followUpIntervalMinutes: Int, next: Long, soundEnabled: Boolean, vibrationEnabled: Boolean) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
    val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmSchedulerModule.ACTION_FIRE_ALARM
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
      putExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME, java.time.Instant.ofEpochMilli(next).toString())
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, repeatDaily)
      putExtra(AlarmSchedulerModule.EXTRA_RINGTONE, ringtone)
      putExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE, visualType)
      putExtra(AlarmSchedulerModule.EXTRA_EMOJI, emoji)
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_UNTIL, repeatUntil)
      putExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_REMAINING, followUpRemaining)
      putExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_INTERVAL_MINUTES, followUpIntervalMinutes)
      putExtra(AlarmSchedulerModule.EXTRA_SOUND_ENABLED, soundEnabled)
      putExtra(AlarmSchedulerModule.EXTRA_VIBRATION_ENABLED, vibrationEnabled)
    }
    val operation = PendingIntent.getBroadcast(
      context,
      requestKey.hashCode(),
      receiverIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val showIntent = Intent(context, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
      putExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME, java.time.Instant.ofEpochMilli(next).toString())
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, repeatDaily)
      putExtra(AlarmSchedulerModule.EXTRA_RINGTONE, ringtone)
      putExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE, visualType)
      putExtra(AlarmSchedulerModule.EXTRA_EMOJI, emoji)
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_UNTIL, repeatUntil)
      putExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_REMAINING, followUpRemaining)
      putExtra(AlarmSchedulerModule.EXTRA_FOLLOW_UP_INTERVAL_MINUTES, followUpIntervalMinutes)
      putExtra(AlarmSchedulerModule.EXTRA_SOUND_ENABLED, soundEnabled)
      putExtra(AlarmSchedulerModule.EXTRA_VIBRATION_ENABLED, vibrationEnabled)
    }
    val showOperation = PendingIntent.getActivity(
      context,
      "show-$requestKey".hashCode(),
      showIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    alarmManager.setAlarmClock(android.app.AlarmManager.AlarmClockInfo(next, showOperation), operation)
  }

  private fun isBeforeRepeatUntil(repeatUntil: String, next: Long = System.currentTimeMillis()): Boolean {
    if (repeatUntil.isBlank()) return true
    return try {
      next <= Instant.parse(repeatUntil).toEpochMilli()
    } catch (_: Exception) {
      true
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(CHANNEL_ID, "VizMinder alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Full-screen visual reminder alarms"
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 450, 200, 450)
      setSound(
        Settings.System.DEFAULT_ALARM_ALERT_URI,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "vizminder-native-alarms-v5"
  }

  private fun wakeForAlarm(context: Context) {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    @Suppress("DEPRECATION")
    val wakeLock = powerManager.newWakeLock(
      PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
      "VizMinder:AlarmWakeLock"
    )
    wakeLock.acquire(10_000L)
  }
}
