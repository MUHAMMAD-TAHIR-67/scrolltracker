package com.scrolltracker

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScrollTrackerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "ScrollTrackerModule"
    private val busListener: (ScrollEventBus.Event) -> Unit = { emitToJs(it) }

    init {
        ScrollEventBus.init(reactContext.applicationContext)
        ScrollEventBus.addListener(busListener)
    }

    private fun eventMap(event: ScrollEventBus.Event) = Arguments.createMap().apply {
        putString("id", event.id)
        putString("packageName", event.packageName)
        putDouble("timestamp", event.timestamp.toDouble())
        putString("eventType", event.eventType)
        event.direction?.let { putString("direction", it) }
        event.appScreen?.let { putString("appScreen", it) }
    }

    private fun emitToJs(event: ScrollEventBus.Event) {
        if (reactApplicationContext.hasActiveReactInstance()) {
            reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onScrollEvent", eventMap(event))
        }
    }

    @ReactMethod fun openAccessibilitySettings() = reactApplicationContext.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
    @ReactMethod fun openUsageAccessSettings() = reactApplicationContext.startActivity(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${reactApplicationContext.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
    @ReactMethod fun openOverlaySettings() = reactApplicationContext.startActivity(
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${reactApplicationContext.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
    @ReactMethod fun isOverlayPermissionGranted(promise: Promise) = promise.resolve(
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(reactApplicationContext)
    )
    @ReactMethod fun requestIgnoreBatteryOptimizations() {
        reactApplicationContext.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${reactApplicationContext.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    @ReactMethod fun isIgnoringBatteryOptimizations(promise: Promise) = try {
        val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        promise.resolve(pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
    } catch (e: Exception) { promise.reject("ERR_BATTERY_OPT_CHECK", e) }

    @ReactMethod fun isAccessibilityServiceEnabled(promise: Promise) = try {
        val expected = "${reactApplicationContext.packageName}/${ScrollAccessibilityService::class.java.name}"
        val enabled = Settings.Secure.getString(reactApplicationContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
        promise.resolve(enabled.split(":").any { it.equals(expected, true) })
    } catch (e: Exception) { promise.reject("ERR_ACCESSIBILITY_CHECK", e) }

    @ReactMethod fun isUsageAccessGranted(promise: Promise) = try {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactApplicationContext.packageName
        ) else appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(), reactApplicationContext.packageName)
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (e: Exception) { promise.reject("ERR_USAGE_ACCESS_CHECK", e) }

    @ReactMethod fun startTrackingService(promise: Promise) = try {
        prefs().edit().putBoolean("tracking_active", true).commit()
        val intent = Intent(reactApplicationContext, TrackerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) reactApplicationContext.startForegroundService(intent)
        else reactApplicationContext.startService(intent)
        promise.resolve(null)
    } catch (e: Exception) { promise.reject("ERR_START_SERVICE", e) }

    @ReactMethod fun stopTrackingService(promise: Promise) = try {
        prefs().edit().putBoolean("tracking_active", false).commit()
        reactApplicationContext.stopService(Intent(reactApplicationContext, TrackerForegroundService::class.java))
        promise.resolve(null)
    } catch (e: Exception) { promise.reject("ERR_STOP_SERVICE", e) }

    @ReactMethod fun drainPendingEvents(promise: Promise) = try {
        val result = Arguments.createArray()
        ScrollEventBus.pending().forEach { result.pushMap(eventMap(it)) }
        promise.resolve(result)
    } catch (e: Exception) { promise.reject("ERR_DRAIN_EVENTS", e) }

    @ReactMethod fun acknowledgeEvents(ids: ReadableArray, promise: Promise) = try {
        val values = (0 until ids.size()).mapNotNull { ids.getString(it) }.toSet()
        ScrollEventBus.acknowledge(values)
        promise.resolve(null)
    } catch (e: Exception) { promise.reject("ERR_ACK_EVENTS", e) }

    @ReactMethod fun syncNativePrefs(thresholdMinutes: Int, enabled: Boolean, promise: Promise) = try {
        prefs().edit().putLong("excessive_scroll_threshold_min", thresholdMinutes.toLong())
            .putBoolean("excessive_scroll_notifications_enabled", enabled).apply()
        promise.resolve(null)
    } catch (e: Exception) { promise.reject("ERR_SYNC_PREFS", e) }

    @ReactMethod fun queryUsageStats(startMillis: Double, endMillis: Double, promise: Promise) = try {
        val stats = (reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager)
            .queryUsageStats(UsageStatsManager.INTERVAL_BEST, startMillis.toLong(), endMillis.toLong())
        val result = Arguments.createArray()
        stats.filter { it.totalTimeInForeground > 0 }.forEach {
            result.pushMap(Arguments.createMap().apply {
                putString("packageName", it.packageName)
                putDouble("totalTimeInForegroundMs", it.totalTimeInForeground.toDouble())
            })
        }
        promise.resolve(result)
    } catch (e: Exception) { promise.reject("ERR_USAGE_STATS_QUERY", e) }

    private fun prefs() = reactApplicationContext.getSharedPreferences("scrolltracker_prefs", Context.MODE_PRIVATE)
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
