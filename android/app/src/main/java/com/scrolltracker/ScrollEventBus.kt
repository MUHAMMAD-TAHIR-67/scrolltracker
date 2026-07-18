package com.scrolltracker

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
 * package names, event type, and optional resource-id/content-desc hints -
 * never any rendered text or video content.
 */
object ScrollEventBus {
    data class Event(
        val packageName: String,
        val timestamp: Long,
        val eventType: String, // matches NativeScrollEvent["eventType"] on the JS side
        val viewIdHint: String? = null,
        val contentDescHint: String? = null,
        val swipeDirection: String? = null, // UP, DOWN, NONE (new field)
        val appScreen: String? = null, // VIDEO_FEED, COMMENTS_OPEN, PROFILE, SEARCH, UNKNOWN (new field)
        val isValidVideoCount: Boolean? = null // pre-calculated validity (new field)
    )

    private const val MAX_BUFFER = 5000

    private val buffer = ArrayDeque<Event>()
    private val listeners = CopyOnWriteArrayList<(Event) -> Unit>()
    private val bufferLock = java.lang.Object()  // Explicit lock for buffer operations

    /**
     * Thread-safe publish. Called from accessibility service thread.
     * If listeners are active, emit directly. Otherwise, buffer the event
     * in a ring buffer (drop oldest if full).
     */
    @Synchronized
    fun publish(event: Event) {
        if (event == null) {
            android.util.Log.w("ScrollEventBus", "Attempt to publish null event")
            return
        }
        
        val activeListeners = listeners.toList()
        if (activeListeners.isEmpty()) {
            synchronized(bufferLock) {
                if (buffer.size >= MAX_BUFFER) {
                    buffer.poll()  // Drop oldest to make room
                }
                buffer.add(event)
            }
        } else {
            activeListeners.forEach { listener ->
                try {
                    listener(event)
                } catch (e: Exception) {
                    android.util.Log.e("ScrollEventBus", "Listener exception", e)
                }
            }
        }
    }

    /**
     * Thread-safe listener registration.
     */
    fun addListener(listener: (Event) -> Unit) {
        if (listener != null) {
            listeners.add(listener)
        }
    }

    /**
     * Thread-safe listener removal.
     */
    fun removeListener(listener: (Event) -> Unit) {
        if (listener != null) {
            listeners.remove(listener)
        }
    }

    /**
     * Thread-safe drain operation. Called from JS thread (React Native).
     * Atomically returns and clears the buffer.
     */
    @Synchronized
    fun drainPending(): List<Event> {
        return synchronized(bufferLock) {
            val drained = buffer.toList()
            buffer.clear()
            drained
        }
    }

    /**
     * Get current buffer size (for diagnostics).
     */
    fun getBufferSize(): Int {
        return synchronized(bufferLock) {
            buffer.size
        }
    }

    /**
     * Clear buffer (for app reset scenarios).
     */
    fun clear() {
        synchronized(bufferLock) {
            buffer.clear()
            listeners.clear()
        }
    }
}
