package com.scrolltracker

import android.accessibilityservice.AccessibilityService
import android.os.Build
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
 * 
 * LIFECYCLE NOTE: This service runs independently of the app UI. Once enabled
 * by the user, it continues receiving events even when the app is backgrounded
 * or the UI is closed. Events are buffered in ScrollEventBus (bounded ring buffer)
 * and persisted to SQLite when the JS runtime is next alive (via drainPendingEvents).
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
            ScrollEventBus.publish(
                ScrollEventBus.Event(
                    packageName = packageName,
                    timestamp = System.currentTimeMillis(),
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

        // getScrollDeltaX/Y were added in API 28 (Android 9) and only carry a
        // meaningful value on typeViewScrolled from a scroll container that
        // reports it (most modern RecyclerView/ViewPager2-based feeds do).
        // On older OS versions, or when unsupported, both stay null and JS
        // falls back to the structural (dwell + view-id-change) heuristic -
        // see SessionEstimator.js#countStructural.
        var scrollDeltaX: Int? = null
        var scrollDeltaY: Int? = null
        if (eventType == "view_scrolled" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                val dx = event.scrollDeltaX
                val dy = event.scrollDeltaY
                if (dx != 0 || dy != 0) {
                    scrollDeltaX = dx
                    scrollDeltaY = dy
                }
            } catch (_: Exception) {
                // Source view didn't report deltas - leave null, structural fallback handles it.
            }
        }

        ScrollEventBus.publish(
            ScrollEventBus.Event(
                packageName = packageName,
                timestamp = System.currentTimeMillis(),
                eventType = eventType,
                viewIdHint = viewIdHint,
                contentDescHint = contentDescHint,
                scrollDeltaX = scrollDeltaX,
                scrollDeltaY = scrollDeltaY
            )
        )
    }

    override fun onInterrupt() {
        Log.w("ScrollTracker", "Accessibility service interrupted by the system")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i("ScrollTracker", "ScrollAccessibilityService connected")
        
        // Ensure the foreground service is running to keep the process alive
        try {
            val intent = android.content.Intent(this, TrackerForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                @Suppress("DEPRECATION")
                startService(intent)
            }
        } catch (e: Exception) {
            Log.w("ScrollTracker", "Failed to start foreground service", e)
        }
    }
    
    override fun onDestroy() {
        Log.i("ScrollTracker", "ScrollAccessibilityService destroyed")
        super.onDestroy()
    }
}