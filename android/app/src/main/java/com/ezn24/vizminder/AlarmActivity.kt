package com.ezn24.vizminder

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class AlarmActivity : Activity() {
  private lateinit var reminderId: String

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    reminderId = intent.getStringExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID) ?: "reminder"
    val title = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TITLE) ?: "Reminder"
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: "Time to check this reminder."
    val fireTime = intent.getStringExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME) ?: ""
    val emoji = intent.getStringExtra(AlarmSchedulerModule.EXTRA_EMOJI) ?: "\uD83D\uDD14"

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      )
    }

    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_FULLSCREEN or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
    )
    setContentView(buildReminderView(title, body, fireTime, emoji))
  }

  private fun safeParseColor(hex: String, defaultColor: Int): Int {
    if (hex.isBlank()) return defaultColor
    return try {
      Color.parseColor(hex)
    } catch (_: Exception) {
      defaultColor
    }
  }

  private fun buildReminderView(title: String, body: String, fireTime: String, emoji: String): LinearLayout {
    val prefs = getSharedPreferences("VizminderPrefs", Context.MODE_PRIVATE)
    val isDark = prefs.getBoolean("isDarkTheme", false)
    
    val primary = safeParseColor(prefs.getString("primaryHex", "") ?: "", if (isDark) Color.rgb(208, 188, 255) else Color.rgb(79, 55, 139))
    val secondary = safeParseColor(prefs.getString("secondaryHex", "") ?: "", if (isDark) Color.rgb(79, 55, 139) else Color.rgb(234, 221, 255))
    val surface = safeParseColor(prefs.getString("backgroundHex", "") ?: "", if (isDark) Color.rgb(20, 18, 24) else Color.rgb(255, 251, 254))
    val visualBg = safeParseColor(prefs.getString("secondaryHex", "") ?: "", if (isDark) Color.rgb(79, 55, 139) else Color.rgb(234, 221, 255))
    val textColor = safeParseColor(prefs.getString("textColorHex", "") ?: "", if (isDark) Color.rgb(230, 224, 233) else Color.rgb(29, 27, 32))
    val subtextColor = safeParseColor(prefs.getString("subtextColorHex", "") ?: "", if (isDark) Color.rgb(202, 196, 208) else Color.rgb(73, 69, 79))

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(22), dp(34), dp(22), dp(34))
      setBackgroundColor(surface)
      layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }
 
    val appName = TextView(this).apply {
      text = "VizMinder"
      textSize = 30f
      typeface = Typeface.DEFAULT
      gravity = Gravity.CENTER
      setTextColor(textColor)
    }
    root.addView(appName, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)))
 
    val visual = TextView(this).apply {
      text = emoji
      textSize = 42f
      gravity = Gravity.CENTER
      background = rounded(visualBg, dp(30))
      includeFontPadding = false
    }
    root.addView(visual, LinearLayout.LayoutParams(dp(104), dp(104)).apply { topMargin = dp(14) })
 
    root.addView(TextView(this), LinearLayout.LayoutParams(1, 0, 1f))
 
    val time = TextView(this).apply {
      text = "It is ${formatAlarmTime(fireTime)} now !"
      textSize = 28f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(primary)
    }
    root.addView(time, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
 
    val question = TextView(this).apply {
      text = "Have you completed\n$title?"
      textSize = 22f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(primary)
      setPadding(0, dp(18), 0, dp(8))
    }
    root.addView(question, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
 
    if (body.isNotBlank()) {
      val bodyView = TextView(this).apply {
        text = body
        textSize = 14f
        gravity = Gravity.CENTER
        setTextColor(subtextColor)
        setPadding(dp(18), 0, dp(18), 0)
        maxLines = 2
      }
      root.addView(bodyView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
 
    root.addView(TextView(this), LinearLayout.LayoutParams(1, 0, 1f))
 
    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    val noButton = TextView(this).apply {
      text = "\u00D7"
      textSize = 42f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      background = oval(primary)
      setOnClickListener { finishAlarm(false) }
    }
    val yesButton = TextView(this).apply {
      text = "\u2713"
      textSize = 42f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      background = oval(secondary)
      setOnClickListener { finishAlarm(false) }
    }
    val confirmButton = TextView(this).apply {
      text = "I really did it"
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(primary)
      background = rounded(Color.TRANSPARENT, dp(22)).apply {
        setStroke(dp(1), primary)
      }
      setOnClickListener { finishAlarm(true) }
    }
    root.addView(confirmButton, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)).apply {
      marginStart = dp(42)
      marginEnd = dp(42)
      bottomMargin = dp(18)
    })
    actionRow.addView(noButton, LinearLayout.LayoutParams(dp(104), dp(104)).apply { marginEnd = dp(24) })
    actionRow.addView(yesButton, LinearLayout.LayoutParams(dp(104), dp(104)).apply { marginStart = dp(24) })
    root.addView(actionRow, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
 
    return root
  }

  private fun finishAlarm(cancelFollowUps: Boolean) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(reminderId.hashCode())
    if (cancelFollowUps) {
      cancelFollowUpAlarms()
    }
    finishAndRemoveTask()
  }

  private fun cancelFollowUpAlarms() {
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (remaining in 0..10) {
      val requestKey = "$reminderId-follow-$remaining"
      val pendingIntent = PendingIntent.getBroadcast(
        this,
        requestKey.hashCode(),
        Intent(this, AlarmReceiver::class.java).apply {
          action = AlarmSchedulerModule.ACTION_FIRE_ALARM
        },
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
      )
      if (pendingIntent != null) {
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
      }
    }
  }

  private fun formatAlarmTime(fireTime: String): String {
    return try {
      DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(fireTime))
    } catch (_: Exception) {
      DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.now())
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private fun rounded(color: Int, radius: Int): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      setColor(color)
      cornerRadius = radius.toFloat()
    }
  }

  private fun oval(color: Int): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(color)
    }
  }
}
