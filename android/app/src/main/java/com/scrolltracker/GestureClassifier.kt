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

    // Last known absolute scrollY per package, used as a fallback direction signal
    // when the framework doesn't populate getScrollDeltaY() (pre-API26 or some OEMs).
    private val lastScrollY = mutableMapOf<String, Int>()

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
        val estimatedDirection = estimateScrollDirection(packageName, event)
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
     * This is heuristic since the API doesn't give us raw touch coordinates or velocity.
     *
     * Returns: UP, DOWN, or null (unknown).
     *
     * IMPORTANT: `event.fromIndex` / `event.toIndex` are populated by AdapterView-style
     * widgets (ListView/GridView) reporting *item indices* - they are essentially never
     * set by the RecyclerView/ViewPager2-based feeds that TikTok, Instagram Reels,
     * YouTube Shorts, and Snapchat Spotlight actually use. Relying on them alone meant
     * direction detection silently failed most of the time. We now prefer, in order:
     *
     *  1. event.scrollDeltaY (API 26+) - the framework-computed pixel delta for this
     *     scroll event. Most reliable when available.
     *  2. A manually tracked delta: current event.scrollY minus the last scrollY we saw
     *     for this package. Works on all API levels since scrollY has been available
     *     since API 21, at the cost of being one event "behind" on the very first sample.
     *  3. fromIndex/toIndex, kept only as a last-resort fallback for any AdapterView-based
     *     screens that do report them (e.g. some in-app lists outside the main feed).
     *
     * Sign convention: a negative deltaY (content moved up / revealed content below)
     * corresponds to the user swiping UP (finger moves up, next video appears).
     * A positive deltaY corresponds to swiping DOWN. This matches Android's standard
     * scroll convention but has NOT been verified against real devices for every one
     * of these four apps - if counts still look inverted after this fix, flip the
     * two branches below rather than re-deriving the whole heuristic.
     */
    private fun estimateScrollDirection(packageName: String, event: AccessibilityEvent): String? {
        try {
            val deltaY = event.scrollDeltaY
            if (deltaY != 0) {
                return if (deltaY < 0) "UP" else "DOWN"
            }
        } catch (_: Exception) {
            // getScrollDeltaY() can throw on some OEM AccessibilityEvent implementations - ignore and fall through.
        }

        try {
            val scrollY = event.scrollY
            if (scrollY != -1) {
                val previous = lastScrollY[packageName]
                lastScrollY[packageName] = scrollY
                if (previous != null && previous != scrollY) {
                    return if (scrollY < previous) "UP" else "DOWN"
                }
                if (previous == null) return null // first sample for this package, no delta yet
            }
        } catch (_: Exception) {
            // fall through to the AdapterView-index fallback
        }

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
        lastScrollY.remove(packageName)
    }

    /**
     * Clear all buffers (called on service disconnect or reset)
     */
    fun clearAllBuffers() {
        scrollEventBuffer.clear()
        lastScrollY.clear()
    }
}