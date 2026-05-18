package com.ezn24.vizmindera4

import android.app.NotificationManager
import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AlarmActivity : Activity() {
  private lateinit var reminderId: String

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    reminderId = intent.getStringExtra(AlarmSchedulerModule.EXTRA_REMINDER_ID) ?: "reminder"
    val title = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TITLE) ?: "VizMinder reminder"
    val body = intent.getStringExtra(AlarmSchedulerModule.EXTRA_BODY) ?: "Time to check this visual reminder."

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

    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val primary = 0xFF4F378B.toInt()
    val surface = 0xFFFFFBFE.toInt()

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(44, 56, 44, 56)
      setBackgroundColor(surface)
      layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }

    val appName = TextView(this).apply {
      text = "VizMinder"
      textSize = 34f
      gravity = Gravity.CENTER
      setTextColor(0xFF1D1B20.toInt())
      setPadding(0, 0, 0, 48)
    }

    val titleView = TextView(this).apply {
      text = title
      textSize = 30f
      gravity = Gravity.CENTER
      setTextColor(primary)
      setPadding(0, 0, 0, 18)
    }

    val bodyView = TextView(this).apply {
      text = body
      textSize = 22f
      gravity = Gravity.CENTER
      setTextColor(primary)
      setPadding(0, 0, 0, 72)
    }

    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }

    val noButton = Button(this).apply {
      text = "No"
      textSize = 22f
      setOnClickListener { finishAlarm() }
    }

    val yesButton = Button(this).apply {
      text = "Yes"
      textSize = 22f
      setOnClickListener { finishAlarm() }
    }

    val buttonParams = LinearLayout.LayoutParams(160, 160).apply {
      marginStart = 24
      marginEnd = 24
    }
    actionRow.addView(noButton, buttonParams)
    actionRow.addView(yesButton, buttonParams)

    root.addView(appName)
    root.addView(titleView)
    root.addView(bodyView)
    root.addView(actionRow)
    setContentView(root)
  }

  private fun finishAlarm() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(reminderId.hashCode())
    finishAndRemoveTask()
  }
}
