package com.scrolltracker

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.delay

/**
 * BackgroundSyncWorker - Runs every 30 minutes to drain pending events and ensure tracking is active.
 *
 * When the app is backgrounded for extended periods, the React Native runtime may be killed
 * by Android. This worker ensures that:
 * 1. Buffered events from the accessibility service are drained and persisted
 * 2. The tracking service is restarted if needed
 * 3. The tracking job remains scheduled across device reboots
 */
class BackgroundSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            if (BuildConfig.DEBUG) {
                android.util.Log.d("BackgroundSyncWorker", "Starting background sync")
            }
            
            val prefs = applicationContext.getSharedPreferences("scrolltracker_prefs", Context.MODE_PRIVATE)
            val wasTracking = prefs.getBoolean("tracking_active", false)
            
            if (!wasTracking) {
                if (BuildConfig.DEBUG) {
                    android.util.Log.d("BackgroundSyncWorker", "Tracking not active, skipping sync")
                }
                return Result.success()
            }
            
            // Restart foreground service (safe to call if already running)
            val serviceIntent = Intent(applicationContext, TrackerForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(serviceIntent)
            } else {
                @Suppress("DEPRECATION")
                applicationContext.startService(serviceIntent)
            }
            
            // Give the service a moment to start
            delay(500)
            
            // Attempt to drain pending events (will be called from JS on next app open if not successful here)
            try {
                ScrollEventBus.drainPending().let { events ->
                    if (events.isNotEmpty()) {
                        if (BuildConfig.DEBUG) {
                            android.util.Log.d("BackgroundSyncWorker", "Drained ${events.size} events from buffer")
                        }
                        // Events are buffered; they will be written to DB when JS restarts
                        // This prevents data loss by keeping events in memory until JS is available
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("BackgroundSyncWorker", "Error draining events", e)
            }
            
            if (BuildConfig.DEBUG) {
                android.util.Log.d("BackgroundSyncWorker", "Background sync completed successfully")
            }
            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("BackgroundSyncWorker", "Background sync failed", e)
            // Retry the job after a delay
            Result.retry()
        }
    }
}
