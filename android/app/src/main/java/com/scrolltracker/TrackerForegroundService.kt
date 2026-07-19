package com.scrolltracker

import android.app.*
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.*
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat

class TrackerForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var foregroundStart: Long? = null
    private var foregroundPackage: String? = null
    private var overlay: TextView? = null
    private var overlayCount = 0
    private val trackedPackages = setOf("com.instagram.android", "com.google.android.youtube",
        "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.snapchat.android")
    private val busListener: (ScrollEventBus.Event) -> Unit = { event ->
        handler.post {
            when (event.eventType) {
                "video_swipe" -> { overlayCount++; showOverlay() }
                "feed_visible" -> showOverlay()
                "feed_hidden" -> hideOverlay()
            }
        }
    }
    private val poll = object : Runnable {
        override fun run() { checkUsage(); handler.postDelayed(this, POLL_INTERVAL_MS) }
    }

    override fun onCreate() {
        super.onCreate()
        ScrollEventBus.init(applicationContext)
        overlayCount = ScrollEventBus.pending().size
        ScrollEventBus.addListener(busListener)
        createChannels()
        startForeground(NOTIFICATION_ID, buildNotification())
        handler.post(poll)
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY
    override fun onDestroy() {
        handler.removeCallbacks(poll)
        ScrollEventBus.removeListener(busListener)
        hideOverlay()
        super.onDestroy()
    }
    override fun onTaskRemoved(rootIntent: Intent?) {
        if (prefs().getBoolean("tracking_active", false)) {
            val restart = Intent(applicationContext, TrackerForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(restart) else startService(restart)
        }
        super.onTaskRemoved(rootIntent)
    }
    override fun onBind(intent: Intent?): IBinder? = null

    private fun showOverlay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return
        val manager = getSystemService(WINDOW_SERVICE) as WindowManager
        if (overlay == null) {
            overlay = TextView(this).apply {
                setTextColor(Color.WHITE); setBackgroundColor(Color.rgb(22, 101, 52))
                textSize = 14f; setPadding(24, 12, 24, 12); importantForAccessibility = TextView.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
            val params = WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT).apply { gravity = Gravity.TOP or Gravity.END; x = 24; y = 96 }
            try { manager.addView(overlay, params) } catch (_: Exception) { overlay = null }
        }
        overlay?.text = overlayCount.toString()
    }
    private fun hideOverlay() {
        val view = overlay ?: return
        try { (getSystemService(WINDOW_SERVICE) as WindowManager).removeView(view) } catch (_: Exception) {}
        overlay = null
    }

    private fun checkUsage() {
        try {
            val now = System.currentTimeMillis()
            val events = (getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager)
                .queryEvents(now - POLL_INTERVAL_MS - 5000, now)
            val item = android.app.usage.UsageEvents.Event()
            var current = foregroundPackage
            while (events.hasNextEvent()) {
                events.getNextEvent(item)
                if (item.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) current = item.packageName
                if (item.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND && item.packageName == current) current = null
            }
            if (current !in trackedPackages) hideOverlay()
            if (current in trackedPackages) {
                if (foregroundPackage != current) foregroundStart = now
                val minutes = (now - (foregroundStart ?: now)) / 60000
                val threshold = prefs().getLong("excessive_scroll_threshold_min", 20)
                if (minutes >= threshold && minutes < threshold + 1) notifyExcessive(current!!, minutes)
            } else foregroundStart = null
            foregroundPackage = current
        } catch (_: Exception) {}
    }

    private fun notifyExcessive(packageName: String, minutes: Long) {
        if (!prefs().getBoolean("excessive_scroll_notifications_enabled", true)) return
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle("$minutes minutes of scrolling")
            .setContentText("You have been scrolling for a while. Consider taking a break.")
            .setSmallIcon(android.R.drawable.ic_dialog_info).setAutoCancel(true).build()
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(ALERT_NOTIFICATION_ID, notification)
    }
    private fun prefs() = getSharedPreferences("scrolltracker_prefs", MODE_PRIVATE)
    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel(ONGOING_CHANNEL_ID, "ScrollTracker monitoring", NotificationManager.IMPORTANCE_MIN))
        manager.createNotificationChannel(NotificationChannel(ALERT_CHANNEL_ID, "Scrolling alerts", NotificationManager.IMPORTANCE_DEFAULT))
    }
    private fun buildNotification() = NotificationCompat.Builder(this, ONGOING_CHANNEL_ID)
        .setContentTitle("ScrollTracker is active").setContentText("Counting short-form videos in the background")
        .setSmallIcon(android.R.drawable.ic_menu_view).setOngoing(true).setPriority(NotificationCompat.PRIORITY_MIN).build()

    companion object {
        private const val NOTIFICATION_ID = 4201
        private const val ALERT_NOTIFICATION_ID = 4202
        private const val ONGOING_CHANNEL_ID = "scrolltracker_ongoing"
        private const val ALERT_CHANNEL_ID = "scrolltracker_alerts"
        private const val POLL_INTERVAL_MS = 60_000L
    }
}
