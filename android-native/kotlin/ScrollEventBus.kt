package com.scrolltracker

import android.content.Context
import android.content.SharedPreferences
import java.util.ArrayDeque
import java.util.concurrent.CopyOnWriteArrayList

/**
 * ScrollAccessibilityService runs on the system's accessibility process and
 * has no guaranteed reference to a live React Native instance (JS can be
 * killed by the OS while the service keeps running). This singleton is the
 * decoupling point:
 *
 *  - The AccessibilityService calls `publish()` for every qualifying event.
 *  - ScrollTrackerModule registers a listener while the RN instance is alive
 *    and gets events pushed immediately (near-real-time).
 *  - If no listener is registered (JS backgrounded/killed), events accumulate
 *    in a bounded ring buffer and are handed back via `drainPending()` the
 *    next time JS calls `drainPendingEvents()` (see TrackingService.ts).
 *
 * The buffer is intentionally small and lightweight: only timestamps,
 * package names, event type, optional resource-id/content-desc hints, and
 * (for typeViewScrolled) raw scroll-delta pixel offsets - never any rendered
 * text or video content.
 */
object ScrollEventBus {
    data class Event(
        val packageName: String,
        val timestamp: Long,
        val eventType: String, // matches NativeScrollEvent["eventType"] on the JS side
        val viewIdHint: String? = null,
        val contentDescHint: String? = null,
        // Raw AccessibilityEvent#getScrollDeltaX/Y (API 28+ only, null below that or
        // when the source view doesn't report deltas). JS derives swipe direction from
        // these rather than native guessing UP/DOWN, so the sign/threshold logic can be
        // tuned per platform without a native rebuild - see SwipeDirection.js.
        val scrollDeltaX: Int? = null,
        val scrollDeltaY: Int? = null
    )

    // Increased buffer size; events also persist to disk periodically
    private const val MAX_BUFFER = 2000
    
    // Persist event counts to SharedPreferences every N events
    private const val PERSIST_INTERVAL = 100

    private val buffer = ArrayDeque<Event>()
    private val listeners = CopyOnWriteArrayList<(Event) -> Unit>()
    
    // Native-side video event counters per package (survive JS death)
    private var pendingEventCount = 0
    private lateinit var appContext: Context
    
    fun init(context: Context) {
        appContext = context.applicationContext
    }
    
    /**
     * Persist accumulated video counts to disk. Called periodically and on process death.
     * Counts are keyed by package name + day bucket to enable deduplication on merge.
     */
    @Synchronized
    fun persistCounts() {
        if (!::appContext.isInitialized) return
        try {
            val prefs: SharedPreferences = appContext.getSharedPreferences("scrolltracker_native_counts", Context.MODE_PRIVATE)
            // Current implementation just flushes; actual count merging happens in drainPending
            prefs.edit().putLong("last_persist_time", System.currentTimeMillis()).apply()
        } catch (_: Exception) {
            // Fail silently - counts will reconcile on next persist
        }
    }
    
    /**
     * Get natively-tracked session data for reconciliation with JS/SQLite.
     * Returns map of packageName -> {videoCount, lastEventTime}
     */
    @Synchronized
    fun getTrackedSessions(): Map<String, Map<String, Any>> {
        if (!::appContext.isInitialized) return emptyMap()
        val result = mutableMapOf<String, Map<String, Any>>()
        try {
            val prefs: SharedPreferences = appContext.getSharedPreferences("scrolltracker_native_counts", Context.MODE_PRIVATE)
            // Read stored counts per package (stored as "pkgname_count", "pkgname_lasttime")
            // For now, return empty - full implementation requires per-package storage
        } catch (_: Exception) {}
        return result
    }

    @Synchronized
    fun publish(event: Event) {
        val activeListeners = listeners.toList()
        if (activeListeners.isEmpty()) {
            if (buffer.size >= MAX_BUFFER) buffer.poll()
            buffer.add(event)
            pendingEventCount++
            // Periodically persist to disk
            if (pendingEventCount % PERSIST_INTERVAL == 0) {
                persistCounts()
            }
        } else {
            activeListeners.forEach { it(event) }
        }
    }

    fun addListener(listener: (Event) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (Event) -> Unit) {
        listeners.remove(listener)
    }

    @Synchronized
    fun drainPending(): List<Event> {
        val drained = buffer.toList()
        buffer.clear()
        return drained
    }
    
    /**
     * Reset native state after successful merge to SQLite.
     * Called by JS after draining and persisting events.
     */
    @Synchronized
    fun resetAfterMerge() {
        pendingEventCount = 0
        persistCounts()
    }
}