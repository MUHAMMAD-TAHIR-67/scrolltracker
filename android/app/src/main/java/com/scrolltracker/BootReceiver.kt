package com.scrolltracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs = context.getSharedPreferences("scrolltracker_prefs", Context.MODE_PRIVATE)
        val wasTracking = prefs.getBoolean("tracking_active", false)
        if (!wasTracking) return

        // Always start the foreground service on boot if it was active
        val serviceIntent = Intent(context, TrackerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        // Always reschedule the background sync job on boot (survives WorkManager reset)
        try {
            val syncWork = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
                30, TimeUnit.MINUTES
            ).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "scroll_tracker_sync",
                ExistingPeriodicWorkPolicy.KEEP,
                syncWork
            )
            android.util.Log.d("BootReceiver", "Background sync job rescheduled after boot")
        } catch (e: Exception) {
            android.util.Log.e("BootReceiver", "Failed to reschedule sync job", e)
        }
    }
}
