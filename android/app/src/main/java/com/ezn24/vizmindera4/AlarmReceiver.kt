package com.ezn24.vizmindera4

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import java.util.Calendar
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val reminderId = intent.getStringExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID) ?: "reminder"
    val title = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TITLE) ?: "VizMinder reminder"
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: "Time to check this visual reminder."
    val fireTime = intent.getStringExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME) ?: ""
    val repeatDaily = intent.getBooleanExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, false)
    val ringtone = intent.getStringExtra(AlarmSchedulerModule.EXTRA_RINGTONE) ?: "alarm"
    val visualType = intent.getStringExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE) ?: "icon"
    val emoji = intent.getStringExtra(AlarmSchedulerModule.EXTRA_EMOJI) ?: "\uD83D\uDD14"

    ensureChannel(context)

    val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
      putExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME, fireTime)
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, repeatDaily)
      putExtra(AlarmSchedulerModule.EXTRA_RINGTONE, ringtone)
      putExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE, visualType)
      putExtra(AlarmSchedulerModule.EXTRA_EMOJI, emoji)
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
      .setSilent(true)
      .setFullScreenIntent(fullScreenIntent, true)
      .setContentIntent(fullScreenIntent)
      .build()

    NotificationManagerCompat.from(context).notify(reminderId.hashCode(), notification)
    context.startActivity(alarmIntent)
    if (repeatDaily) {
      scheduleNextDailyAlarm(context, reminderId, title, body, ringtone, visualType, emoji)
    }
  }

  private fun scheduleNextDailyAlarm(context: Context, reminderId: String, title: String, body: String, ringtone: String, visualType: String, emoji: String) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
    val next = Calendar.getInstance().apply {
      timeInMillis = System.currentTimeMillis()
      add(Calendar.DATE, 1)
    }.timeInMillis

    val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmSchedulerModule.ACTION_FIRE_ALARM
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
      putExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME, java.time.Instant.ofEpochMilli(next).toString())
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, true)
      putExtra(AlarmSchedulerModule.EXTRA_RINGTONE, ringtone)
      putExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE, visualType)
      putExtra(AlarmSchedulerModule.EXTRA_EMOJI, emoji)
    }
    val operation = PendingIntent.getBroadcast(
      context,
      reminderId.hashCode(),
      receiverIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val showIntent = Intent(context, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
      putExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME, java.time.Instant.ofEpochMilli(next).toString())
      putExtra(AlarmSchedulerModule.EXTRA_REPEAT_DAILY, true)
      putExtra(AlarmSchedulerModule.EXTRA_RINGTONE, ringtone)
      putExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE, visualType)
      putExtra(AlarmSchedulerModule.EXTRA_EMOJI, emoji)
    }
    val showOperation = PendingIntent.getActivity(
      context,
      "show-$reminderId".hashCode(),
      showIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    alarmManager.setAlarmClock(android.app.AlarmManager.AlarmClockInfo(next, showOperation), operation)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(CHANNEL_ID, "VizMinder alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Full-screen visual reminder alarms"
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 450, 200, 450)
      setSound(null, null)
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "vizminder-native-alarms-v2"
  }
}
