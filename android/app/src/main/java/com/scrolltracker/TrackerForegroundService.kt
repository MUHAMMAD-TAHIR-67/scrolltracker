package com.scrolltracker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * A minimal foreground service whose primary jobs are:
 *
 *  1. Keep the app process alive so the AccessibilityService's events reach
 *     a live JS runtime as often as possible (Android is much less likely to
 *     kill a process that owns a running foreground service).
 *  2. Show the ongoing notification Android requires for any foreground
 *     service, framed transparently ("ScrollTracker is monitoring app usage").
 *  3. Run a cheap, native fallback check every POLL_INTERVAL_MS using
 *     UsageStatsManager (not the accessibility event stream) so
 *     "excessive scrolling" alerts still fire even if the JS runtime has
 *     been killed by the OS to save memory - this is the resilience path
 *     complementing TrackingService.ts's own in-JS sweep.
 *
 * Polling every 60s (rather than listening continuously) keeps battery
 * impact low; UsageStatsManager queries are cheap aggregate reads, not
 * continuous sensors.
 */
class TrackerForegroundService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var continuousForegroundStart: Long? = null
    private var lastForegroundPackage: String? = null

    private val trackedPackages = setOf(
        "com.instagram.android",
        "com.google.android.youtube",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.snapchat.android"
    )

    private val pollRunnable = object : Runnable {
        override fun run() {
            checkExcessiveScrolling()
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        handler.post(pollRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: ask the OS to recreate the service (and re-show the
        // notification) if it's killed under memory pressure, without
        // redelivering the last intent.
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(pollRunnable)
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val restartIntent = Intent(applicationContext, TrackerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(restartIntent)
        } else {
            applicationContext.startService(restartIntent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun checkExcessiveScrolling() {
        try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(now - POLL_INTERVAL_MS - 5_000, now)
            var currentForeground: String? = lastForegroundPackage
            val event = android.app.usage.UsageEvents.Event()

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    currentForeground = event.packageName
                } else if (event.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND &&
                    event.packageName == currentForeground
                ) {
                    currentForeground = null
                }
            }

            if (currentForeground != null && currentForeground in trackedPackages) {
                if (lastForegroundPackage != currentForeground) {
                    continuousForegroundStart = now
                }
                val dwellMs = now - (continuousForegroundStart ?: now)
                val thresholdMs = readThresholdMinutes() * 60_000L

                if (dwellMs >= thresholdMs && dwellMs < thresholdMs + POLL_INTERVAL_MS) {
                    notifyExcessiveScrolling(currentForeground!!, dwellMs / 60_000)
                }
            } else {
                continuousForegroundStart = null
            }
            lastForegroundPackage = currentForeground
        } catch (_: Exception) {
            // Fails safe: a missed poll cycle just delays a notification, never crashes the service.
        }
    }

    private fun readThresholdMinutes(): Long {
        val prefs: SharedPreferences = getSharedPreferences("scrolltracker_prefs", MODE_PRIVATE)
        return prefs.getLong("excessive_scroll_threshold_min", 20L)
    }

    private fun notifyExcessiveScrolling(packageName: String, minutes: Long) {
        val prefs = getSharedPreferences("scrolltracker_prefs", MODE_PRIVATE)
        if (!prefs.getBoolean("excessive_scroll_notifications_enabled", true)) return

        val displayName = when (packageName) {
            "com.instagram.android" -> "Instagram Reels"
            "com.google.android.youtube" -> "YouTube Shorts"
            "com.zhiliaoapp.musically", "com.ss.android.ugc.trill" -> "TikTok"
            "com.snapchat.android" -> "Snapchat Spotlight"
            else -> packageName
        }

        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle("$minutes minutes of scrolling")
            .setContentText("You've been on $displayName for a while. Maybe take a break?")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(ALERT_NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        manager.createNotificationChannel(
            NotificationChannel(
                ONGOING_CHANNEL_ID,
                "ScrollTracker monitoring",
                NotificationManager.IMPORTANCE_MIN
            ).apply { description = "Ongoing notification while ScrollTracker is active" }
        )
        manager.createNotificationChannel(
            NotificationChannel(
                ALERT_CHANNEL_ID,
                "Scrolling alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "Alerts for excessive scrolling and daily limits" }
        )
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, ONGOING_CHANNEL_ID)
            .setContentTitle("ScrollTracker is active")
            .setContentText("Counting short-form videos in the background")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    companion object {
        private const val NOTIFICATION_ID = 4201
        private const val ALERT_NOTIFICATION_ID = 4202
        private const val ONGOING_CHANNEL_ID = "scrolltracker_ongoing"
        private const val ALERT_CHANNEL_ID = "scrolltracker_alerts"
        private const val POLL_INTERVAL_MS = 60_000L
    }
}
