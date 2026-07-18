package com.scrolltracker

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScrollTrackerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ScrollTrackerModule"

    private val busListener: (ScrollEventBus.Event) -> Unit = { event ->
        emitToJs(event)
    }

    init {
        ScrollEventBus.addListener(busListener)
    }

    private fun emitToJs(event: ScrollEventBus.Event) {
        val map = Arguments.createMap().apply {
            putString("packageName", event.packageName)
            putDouble("timestamp", event.timestamp.toDouble())
            putString("eventType", event.eventType)
            event.viewIdHint?.let { putString("viewIdHint", it) }
            event.contentDescHint?.let { putString("contentDescHint", it) }
            event.scrollDeltaX?.let { putInt("scrollDeltaX", it) }
            event.scrollDeltaY?.let { putInt("scrollDeltaY", it) }
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onScrollEvent", map)
    }

    // --- Settings navigation -------------------------------------------------

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun openUsageAccessSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            data = Uri.parse("package:${reactApplicationContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        val packageName = reactApplicationContext.packageName
        val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
        } catch (e: Exception) {
            promise.reject("ERR_BATTERY_OPT_CHECK", e)
        }
    }
    // --- Permission checks ----------------------------------------------------

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            val expected = "${reactApplicationContext.packageName}/${ScrollAccessibilityService::class.java.name}"
            val enabledServices = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""

            val isEnabled = enabledServices.split(":").any { it.equals(expected, ignoreCase = true) }
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.reject("ERR_ACCESSIBILITY_CHECK", e)
        }
    }

    @ReactMethod
    fun isUsageAccessGranted(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    reactApplicationContext.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    reactApplicationContext.packageName
                )
            }
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.reject("ERR_USAGE_ACCESS_CHECK", e)
        }
    }

    // --- Service control --------------------------------------------------

    @ReactMethod
    fun startTrackingService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, TrackerForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            prefs().edit().putBoolean("tracking_active", true).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_START_SERVICE", e)
        }
    }

    @ReactMethod
    fun stopTrackingService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, TrackerForegroundService::class.java)
            reactApplicationContext.stopService(intent)
            prefs().edit().putBoolean("tracking_active", false).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_STOP_SERVICE", e)
        }
    }

    private fun prefs() =
        reactApplicationContext.getSharedPreferences("scrolltracker_prefs", Context.MODE_PRIVATE)

    /**
     * Mirrors a small subset of settings from the JS-side SQLite `settings`
     * table into plain SharedPreferences, because TrackerForegroundService
     * (which may run its excessive-scrolling poll while JS/SQLite isn't
     * initialized) reads them natively without a cross-language DB dependency.
     */
    @ReactMethod
    fun syncNativePrefs(thresholdMinutes: Int, excessiveScrollNotificationsEnabled: Boolean, promise: Promise) {
        try {
            prefs().edit()
                .putLong("excessive_scroll_threshold_min", thresholdMinutes.toLong())
                .putBoolean("excessive_scroll_notifications_enabled", excessiveScrollNotificationsEnabled)
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_SYNC_PREFS", e)
        }
    }

    // --- UsageStatsManager query (cross-check / fallback duration source) ----

    @ReactMethod
    fun queryUsageStats(startMillis: Double, endMillis: Double, promise: Promise) {
        try {
            val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                startMillis.toLong(),
                endMillis.toLong()
            )
            val result = Arguments.createArray()
            stats
                .filter { it.totalTimeInForeground > 0 }
                .forEach { usageStat ->
                    val map = Arguments.createMap().apply {
                        putString("packageName", usageStat.packageName)
                        putDouble("totalTimeInForegroundMs", usageStat.totalTimeInForeground.toDouble())
                    }
                    result.pushMap(map)
                }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERR_USAGE_STATS_QUERY", e)
        }
    }

    // --- Ring buffer drain (events that arrived while JS was not listening) --

    @ReactMethod
    fun drainPendingEvents(promise: Promise) {
        try {
            val events = ScrollEventBus.drainPending()
            val result = Arguments.createArray()
            events.forEach { event ->
                val map = Arguments.createMap().apply {
                    putString("packageName", event.packageName)
                    putDouble("timestamp", event.timestamp.toDouble())
                    putString("eventType", event.eventType)
                    event.viewIdHint?.let { putString("viewIdHint", it) }
                    event.contentDescHint?.let { putString("contentDescHint", it) }
                    event.scrollDeltaX?.let { putInt("scrollDeltaX", it) }
                    event.scrollDeltaY?.let { putInt("scrollDeltaY", it) }
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERR_DRAIN_EVENTS", e)
        }
    }

    // Required no-ops for NativeEventEmitter's addListener/removeListeners calls on Android
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}