package com.scrolltracker

import android.view.accessibility.AccessibilityEvent
import kotlin.math.abs

/**
 * GestureClassifier detects and classifies vertical swipes from accessibility events.
 *
 * Since Android's Accessibility API does not directly expose gesture coordinates or
 * velocity, we infer swipes from consecutive TYPE_VIEW_SCROLLED events with:
 * - Consistent vertical direction (all up or all down)
 * - Minimal horizontal displacement
 * - Rapid succession (within window_ms)
 *
 * This approach is conservative: we only flag as UP/DOWN when we have high confidence.
 * Otherwise, we return NONE.
 *
 * PRIVACY NOTE: We never inspect the scrollable view's content or hierarchy.
 * We only use event metadata (type, resource-id hints) already provided by Android.
 */
object GestureClassifier {

    // Tunable parameters
    private const val SWIPE_WINDOW_MS = 500L      // Time window for consecutive scroll events
    private const val MIN_CONSECUTIVE_EVENTS = 2   // Minimum scroll events to constitute a swipe
    private const val DIRECTION_CONSISTENCY = 0.75 // 75% of events must be same direction

    data class GestureResult(
        val direction: String, // UP, DOWN, NONE
        val confidence: Float   // 0.0 to 1.0
    )

    private data class ScrollEvent(
        val timestamp: Long,
        val direction: String // UP or DOWN
    )

    // Ring buffer of recent scroll events per package
    private val scrollEventBuffer = mutableMapOf<String, MutableList<ScrollEvent>>()

    /**
     * Classifies a TYPE_VIEW_SCROLLED event.
     * Returns UP, DOWN, or NONE based on context of recent events.
     */
    fun classifyScroll(
        packageName: String,
        event: AccessibilityEvent,
        timestamp: Long
    ): GestureResult {
        // Try to infer direction from event metadata
        val estimatedDirection = estimateScrollDirection(event)
        if (estimatedDirection == null) {
            clearBuffer(packageName) // Reset on unknown
            return GestureResult("NONE", 0f)
        }

        // Add to buffer
        val buffer = scrollEventBuffer.getOrPut(packageName) { mutableListOf() }
        buffer.add(ScrollEvent(timestamp, estimatedDirection))

        // Prune old events outside the window
        val cutoff = timestamp - SWIPE_WINDOW_MS
        buffer.removeAll { it.timestamp < cutoff }

        if (buffer.size < MIN_CONSECUTIVE_EVENTS) {
            return GestureResult("NONE", 0f)
        }

        // Check if we have consistent direction
        val upCount = buffer.count { it.direction == "UP" }
        val downCount = buffer.count { it.direction == "DOWN" }
        val total = buffer.size

        val upRatio = upCount.toFloat() / total
        val downRatio = downCount.toFloat() / total

        return when {
            upRatio >= DIRECTION_CONSISTENCY -> GestureResult("UP", upRatio)
            downRatio >= DIRECTION_CONSISTENCY -> GestureResult("DOWN", downRatio)
            else -> GestureResult("NONE", maxOf(upRatio, downRatio))
        }
    }

    /**
     * Attempt to infer scroll direction from accessibility event.
     * This is heuristic since the API doesn't give us raw coordinates.
     *
     * Returns: UP, DOWN, or null (unknown).
     *
     * Heuristics:
     * - If the event.fromIndex < event.toIndex, content scrolled down (user scrolled UP)
     * - If the event.fromIndex > event.toIndex, content scrolled up (user scrolled DOWN)
     * - Otherwise, we can't reliably infer direction
     */
    private fun estimateScrollDirection(event: AccessibilityEvent): String? {
        return try {
            val fromIndex = event.fromIndex
            val toIndex = event.toIndex

            when {
                fromIndex >= 0 && toIndex >= 0 && fromIndex != toIndex -> {
                    if (toIndex > fromIndex) "UP" else "DOWN"
                }
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Clear the buffer for a package (called on window state changes, app switch, etc.)
     */
    fun clearBuffer(packageName: String) {
        scrollEventBuffer.remove(packageName)
    }

    /**
     * Clear all buffers (called on service disconnect or reset)
     */
    fun clearAllBuffers() {
        scrollEventBuffer.clear()
    }
}
