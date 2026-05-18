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
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val reminderId = intent.getStringExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID) ?: "reminder"
    val title = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TITLE) ?: "VizMinder reminder"
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: "Time to check this visual reminder."

    ensureChannel(context)

    val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_TITLE, title)
      putExtra(AlarmSchedulerModule.EXTRA_BODY, body)
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
      .setFullScreenIntent(fullScreenIntent, true)
      .setContentIntent(fullScreenIntent)
      .build()

    NotificationManagerCompat.from(context).notify(reminderId.hashCode(), notification)
    context.startActivity(alarmIntent)
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
        android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI,
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
    const val CHANNEL_ID = "vizminder-native-alarms"
  }
}
