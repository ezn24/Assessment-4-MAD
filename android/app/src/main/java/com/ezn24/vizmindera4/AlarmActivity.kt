package com.ezn24.vizmindera4

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
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
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: "Time to check this visual reminder."
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

  private fun buildReminderView(title: String, body: String, fireTime: String, emoji: String): LinearLayout {
    val primary = Color.rgb(79, 55, 139)
    val secondary = Color.rgb(200, 180, 255)
    val surface = Color.rgb(255, 251, 254)
    val visualBg = Color.rgb(234, 221, 255)

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
      setTextColor(Color.rgb(29, 27, 32))
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
        setTextColor(Color.rgb(73, 69, 79))
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
      setOnClickListener { finishAlarm() }
    }
    val yesButton = TextView(this).apply {
      text = "\u2713"
      textSize = 42f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      background = oval(secondary)
      setOnClickListener { finishAlarm() }
    }
    actionRow.addView(noButton, LinearLayout.LayoutParams(dp(104), dp(104)).apply { marginEnd = dp(24) })
    actionRow.addView(yesButton, LinearLayout.LayoutParams(dp(104), dp(104)).apply { marginStart = dp(24) })
    root.addView(actionRow, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    return root
  }

  private fun finishAlarm() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(reminderId.hashCode())
    finishAndRemoveTask()
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
