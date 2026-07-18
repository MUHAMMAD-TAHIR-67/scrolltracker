package com.scrolltracker

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log

/**
 * ScrollTracker's AccessibilityService.
 *
 * IMPORTANT (privacy): this service never calls getRootInActiveWindow() or
 * walks the node tree to read text. It only reads the fields Android attaches
 * directly to the AccessibilityEvent that fired - source class name,
 * resource-id (if flagReportViewIds is set, see accessibility_service_config.xml),
 * and content-description, when the OS/app chooses to expose one. No caption
 * text, usernames, or video content are read, and nothing is logged verbosely
 * in release builds.
 *
 * IMPORTANT (accuracy): Android gives no semantic "video index" signal. We
 * approximate "the user reached a new video" using a mix of:
 *  - TYPE_WINDOW_STATE_CHANGED -> app came to foreground / navigated screens
 *  - TYPE_VIEW_SCROLLED        -> a scrollable container moved (candidate for
 *                                 a full-page swipe in a Reels/Shorts feed)
 *  - TYPE_WINDOW_CONTENT_CHANGED -> the visible content subtree changed,
 *                                 which a RecyclerView/ViewPager2 page swap
 *                                 typically triggers
 *
 * The actual "is this really a new video" decision (debouncing, minimum
 * dwell time, loop detection) happens in JS (SessionEstimator.ts) so the
 * heuristic can be iterated on without a native rebuild. This service's job
 * is only to forward candidate structural signals cheaply.
 */
class ScrollAccessibilityService : AccessibilityService() {

    private val trackedPackages = setOf(
        "com.instagram.android",
        "com.google.android.youtube",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill", // TikTok's alternate package id in some regions
        "com.snapchat.android"
    )

    private var lastForegroundPackage: String? = null

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val packageName = event.packageName?.toString() ?: return
        if (packageName !in trackedPackages) return

        val timestamp = System.currentTimeMillis()
        val eventType = when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> "window_state_changed"
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> "view_scrolled"
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> "content_changed"
            else -> return
        }

        // Emit an explicit app_foreground the first time we see a tracked
        // package become active, so TrackingService.ts can open a session.
        if (eventType == "window_state_changed" && lastForegroundPackage != packageName) {
            lastForegroundPackage = packageName
            // Reset state trackers on app switch
            GestureClassifier.clearBuffer(packageName)
            AppScreenStateTracker.clearState(packageName)
            ScrollEventBus.publish(
                ScrollEventBus.Event(
                    packageName = packageName,
                    timestamp = timestamp,
                    eventType = "app_foreground"
                )
            )
        }

        val viewIdHint = try {
            event.source?.viewIdResourceName
        } catch (_: Exception) {
            null
        }
        val contentDescHint = event.contentDescription?.toString()?.take(40) // hint only, never stored verbatim by JS

        // Update screen state machine
        val appScreen = AppScreenStateTracker.updateState(packageName, event)

        // Classify gesture if this is a scroll event
        var swipeDirection: String? = null
        var isValidVideoCount: Boolean? = null
        if (eventType == "view_scrolled") {
            val gestureResult = GestureClassifier.classifyScroll(packageName, event, timestamp)
            swipeDirection = if (gestureResult.direction != "NONE") gestureResult.direction else null
            // Video count is valid if:
            // - We detected a swipe (UP or DOWN)
            // - We're in VIDEO_FEED state
            // - It's not a comment scroll
            isValidVideoCount = swipeDirection != null && appScreen == "VIDEO_FEED"
        }

        ScrollEventBus.publish(
            ScrollEventBus.Event(
                packageName = packageName,
                timestamp = timestamp,
                eventType = eventType,
                viewIdHint = viewIdHint,
                contentDescHint = contentDescHint,
                swipeDirection = swipeDirection,
                appScreen = appScreen,
                isValidVideoCount = isValidVideoCount
            )
        )
    }

    override fun onInterrupt() {
        Log.w("ScrollTracker", "Accessibility service interrupted by the system")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i("ScrollTracker", "ScrollAccessibilityService connected")
    }
}
