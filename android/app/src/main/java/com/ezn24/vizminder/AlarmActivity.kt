package com.ezn24.vizminder

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ImageView
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
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
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: ""
    val fireTime = intent.getStringExtra(AlarmSchedulerModule.EXTRA_FIRE_TIME) ?: ""
    val visualType = intent.getStringExtra(AlarmSchedulerModule.EXTRA_VISUAL_TYPE) ?: "icon"
    val icon = intent.getStringExtra(AlarmSchedulerModule.EXTRA_ICON) ?: "bell-outline"
    val emoji = intent.getStringExtra(AlarmSchedulerModule.EXTRA_EMOJI) ?: "\uD83D\uDD14"
    val imageUri = intent.getStringExtra(AlarmSchedulerModule.EXTRA_IMAGE_URI) ?: ""

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
    setContentView(buildReminderView(title, body, fireTime, visualType, icon, emoji, imageUri))
  }

  private fun safeParseColor(hex: String, defaultColor: Int): Int {
    if (hex.isBlank()) return defaultColor
    return try {
      Color.parseColor(hex)
    } catch (_: Exception) {
      defaultColor
    }
  }

  private fun buildReminderView(title: String, body: String, fireTime: String, visualType: String, icon: String, emoji: String, imageUri: String): LinearLayout {
    val prefs = getSharedPreferences("VizminderPrefs", Context.MODE_PRIVATE)
    val isDark = prefs.getBoolean("isDarkTheme", false)

    val primary = safeParseColor(prefs.getString("primaryHex", "") ?: "", if (isDark) Color.rgb(208, 188, 255) else Color.rgb(79, 55, 139))
    val secondary = safeParseColor(prefs.getString("secondaryHex", "") ?: "", if (isDark) Color.rgb(79, 55, 139) else Color.rgb(234, 221, 255))
    val surface = safeParseColor(prefs.getString("backgroundHex", "") ?: "", if (isDark) Color.rgb(20, 18, 24) else Color.rgb(255, 251, 254))
    val visualBg = safeParseColor(prefs.getString("secondaryHex", "") ?: "", if (isDark) Color.rgb(79, 55, 139) else Color.rgb(234, 221, 255))
    val textColor = safeParseColor(prefs.getString("textColorHex", "") ?: "", if (isDark) Color.rgb(230, 224, 233) else Color.rgb(29, 27, 32))
    val subtextColor = safeParseColor(prefs.getString("subtextColorHex", "") ?: "", if (isDark) Color.rgb(202, 196, 208) else Color.rgb(73, 69, 79))

    val iconTypeface = runCatching { Typeface.createFromAsset(assets, "fonts/MaterialCommunityIcons.ttf") }.getOrNull()

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

    val visualContainer = LinearLayout(this).apply {
      gravity = Gravity.CENTER
      background = rounded(visualBg, dp(30))
      clipToOutline = true
    }
    if (visualType == "image" && imageUri.isNotBlank()) {
      val image = ImageView(this).apply {
        scaleType = ImageView.ScaleType.CENTER_CROP
        background = rounded(visualBg, dp(30))
        clipToOutline = true
        setImageURI(Uri.parse(imageUri))
      }
      visualContainer.addView(image, LinearLayout.LayoutParams(dp(128), dp(128)))
    } else {
      val visual = TextView(this).apply {
        text = if (visualType == "emoji") emoji else iconGlyph(icon)
        textSize = if (visualType == "emoji") 54f else 60f
        gravity = Gravity.CENTER
        setTextColor(primary)
        if (visualType != "emoji" && iconTypeface != null) {
          typeface = iconTypeface
        }
        includeFontPadding = false
      }
      visualContainer.addView(visual, LinearLayout.LayoutParams(dp(128), dp(128)))
    }
    root.addView(visualContainer, LinearLayout.LayoutParams(dp(128), dp(128)).apply { topMargin = dp(14) })
    startPulse(visualContainer)

    // spacer
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
      text = "Have you completed the task?"
      textSize = 22f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(primary)
      setPadding(dp(16), dp(18), dp(16), dp(18))
    }
    val title = TextView(this).apply {
      text = title
      textSize = 40f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(primary)
      setPadding(dp(16), dp(18), dp(16), dp(18))
    }
    root.addView(question, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    root.addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    // Show description if set
    if (body.isNotBlank()) {
      val bodyView = TextView(this).apply {
        text = body
        textSize = 18f
        gravity = Gravity.CENTER
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(primary)
        setPadding(dp(18), 0, dp(18), dp(8))
        maxLines = 3
      }
      root.addView(bodyView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    // "I really did it" confirm button
    val confirmButton = TextView(this).apply {
      text = "🧠 I really did it"
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(primary)
      background = rounded(Color.TRANSPARENT, dp(22)).apply {
        setStroke(dp(1), primary)
      }
      setOnClickListener { finishAlarm("confirmed") }
    }
    root.addView(confirmButton, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)).apply {
      marginStart = dp(42)
      marginEnd = dp(42)
      topMargin = dp(12)
    })

    // spacer
    root.addView(TextView(this), LinearLayout.LayoutParams(1, 0, 1f))

    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    val noButton = TextView(this).apply {
      text = iconGlyph("close")
      textSize = 48f
      if (iconTypeface != null) typeface = iconTypeface
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      background = oval(primary)
      setOnClickListener { finishAlarm("no") }
    }
    // Fix: Yes button now correctly calls finishAlarm("yes") with the right colour
    val yesButton = TextView(this).apply {
      text = iconGlyph("check")
      textSize = 48f
      if (iconTypeface != null) typeface = iconTypeface
      gravity = Gravity.CENTER
      setTextColor(if (isDark) Color.rgb(29, 27, 32) else Color.WHITE)
      background = oval(secondary)
      setOnClickListener { finishAlarm("yes") }
    }
    actionRow.addView(noButton, LinearLayout.LayoutParams(dp(104), dp(104)).apply { marginEnd = dp(24) })
    actionRow.addView(yesButton, LinearLayout.LayoutParams(dp(104), dp(104)).apply { marginStart = dp(24) })
    root.addView(actionRow, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    return root
  }

  /**
   * Dismiss the alarm, broadcast the user's response to React Native via
   * the AlarmSchedulerModule so that prompt stats can be updated in storage.
   *
   * mode: "yes" | "no" | "confirmed"
   */
  private fun finishAlarm(mode: String) {
    // Cancel the ongoing notification
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(reminderId.hashCode())

    if (mode == "confirmed") {
      cancelFollowUpAlarms()
    }

    // Broadcast the response to AlarmSchedulerModule so RN can record stats
    val responseIntent = Intent(AlarmSchedulerModule.ACTION_ALARM_RESPONSE).apply {
      setPackage(packageName)
      putExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID, reminderId)
      putExtra(AlarmSchedulerModule.EXTRA_ALARM_MODE, mode)
    }
    sendBroadcast(responseIntent)

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

  private fun startPulse(target: android.view.View) {
    val scaleX = ObjectAnimator.ofFloat(target, "scaleX", 1f, 1.06f, 1f)
    val scaleY = ObjectAnimator.ofFloat(target, "scaleY", 1f, 1.06f, 1f)
    AnimatorSet().apply {
      playTogether(scaleX, scaleY)
      duration = 1800L
      interpolator = AccelerateDecelerateInterpolator()
      addListener(object : android.animation.AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: android.animation.Animator) {
          target.post { startPulse(target) }
        }
      })
      start()
    }
  }

  private fun iconGlyph(icon: String): String {
    return when (icon) {
      "bell-outline" -> String(Character.toChars(983196))
      "key" -> String(Character.toChars(983814))
      "fire" -> String(Character.toChars(983608))
      "tshirt-crew" -> String(Character.toChars(985723))
      "pill" -> String(Character.toChars(984066))
      "wallet-outline" -> String(Character.toChars(986077))
      "shoe-sneaker" -> String(Character.toChars(988616))
      "book-open-page-variant" -> String(Character.toChars(984538))
      "water" -> String(Character.toChars(984460))
      "food-apple-outline" -> String(Character.toChars(986244))
      "coffee-outline" -> String(Character.toChars(984778))
      "toothbrush-paste" -> String(Character.toChars(987434))
      "trash-can-outline" -> String(Character.toChars(985722))
      "email-outline" -> String(Character.toChars(983536))
      "phone-outline" -> String(Character.toChars(986608))
      "cart-outline" -> String(Character.toChars(983313))
      "home-outline" -> String(Character.toChars(984737))
      "briefcase-outline" -> String(Character.toChars(985108))
      "calendar-check-outline" -> String(Character.toChars(986180))
      "run" -> String(Character.toChars(984846))
      "bed-outline" -> String(Character.toChars(983193))
      "car-outline" -> String(Character.toChars(988397))
      "umbrella-outline" -> String(Character.toChars(984395))
      "lightbulb-outline" -> String(Character.toChars(983862))
      "close" -> String(Character.toChars(983382))
      "check" -> String(Character.toChars(983340))
      else -> String(Character.toChars(983196))
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
