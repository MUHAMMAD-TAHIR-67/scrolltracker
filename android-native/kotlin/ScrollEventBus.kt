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
        val contentDescHint: String? = null
    )

    private const val MAX_BUFFER = 500

    private val buffer = ArrayDeque<Event>()
    private val listeners = CopyOnWriteArrayList<(Event) -> Unit>()

    @Synchronized
    fun publish(event: Event) {
        val activeListeners = listeners.toList()
        if (activeListeners.isEmpty()) {
            if (buffer.size >= MAX_BUFFER) buffer.poll()
            buffer.add(event)
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
}
