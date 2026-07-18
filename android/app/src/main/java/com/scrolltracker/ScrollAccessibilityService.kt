package com.scrolltracker

import android.accessibilityservice.AccessibilityService
import android.content.Intent
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
 * CRITICAL: This service operates INDEPENDENTLY from the app UI. Once the
 * Accessibility permission is granted, tracking continues even if the app
 * process is killed, because:
 * 1. The service runs in its own process bound by the system
 * 2. TrackerForegroundService keeps the process alive with START_STICKY
 * 3. Events are buffered in ScrollEventBus until JS runtime is available
 * 4. BootReceiver restarts the ForegroundService after reboot
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
    
    // Track state per package to properly detect screen transitions
    private val packageStates = mutableMapOf<String, String>()
    
    // Track last scroll deltas to detect direction changes across event types
    private val lastScrollDeltas = mutableMapOf<String, Pair<Int?, Int?>>()

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val packageName = event.packageName?.toString() ?: return
        if (packageName !in trackedPackages) return

        // Update screen state using AppScreenStateTracker
        val appState = AppScreenStateTracker.updateState(packageName, event)
        
        val eventType = when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> "window_state_changed"
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> "view_scrolled"
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> "content_changed"
            else -> return
        }

        // Emit an explicit app_foreground the first time we see a tracked
        // package become active, so TrackingService.ts can open a session.
        if (eventType == "window_state_changed") {
            val prevState = packageStates[packageName]
            if (prevState == null || prevState != appState) {
                packageStates[packageName] = appState
                
                // Always emit app_foreground when entering a tracked app
                // This ensures sessions are opened even if UI is not running
                ScrollEventBus.publish(
                    ScrollEventBus.Event(
                        packageName = packageName,
                        timestamp = System.currentTimeMillis(),
                        eventType = "app_foreground",
                        viewIdHint = appState // Pass state as hint for JS-side processing
                    )
                )
            }
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
        //
        // CRITICAL FIX: Capture deltas on BOTH view_scrolled AND content_changed
        // events. Many vertical feeds emit content_changed without view_scrolled
        // when transitioning between videos, especially TikTok and Instagram Reels.
        var scrollDeltaX: Int? = null
        var scrollDeltaY: Int? = null
        val shouldCaptureDeltas = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
                (eventType == "view_scrolled" || eventType == "content_changed")
        
        if (shouldCaptureDeltas) {
            try {
                val dx = event.scrollDeltaX
                val dy = event.scrollDeltaY
                if (dx != 0 || dy != 0) {
                    scrollDeltaX = dx
                    scrollDeltaY = dy
                    // Store for cross-event-type tracking
                    lastScrollDeltas[packageName] = Pair(dx, dy)
                }
            } catch (_: Exception) {
                // Source view didn't report deltas - leave null, structural fallback handles it.
            }
        }
        
        // If no deltas on this event but we have recent ones from same package,
        // attach them as context for JS-side swipe detection
        if (scrollDeltaX == null && scrollDeltaY == null) {
            val lastDelta = lastScrollDeltas[packageName]
            if (lastDelta != null) {
                scrollDeltaX = lastDelta.first
                scrollDeltaY = lastDelta.second
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
        
        // Ensure the ForegroundService is running to keep our process alive
        // This is critical for tracking to work when the UI is closed
        try {
            val fgIntent = Intent(this, TrackerForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(fgIntent)
            } else {
                startService(fgIntent)
            }
        } catch (e: Exception) {
            Log.e("ScrollTracker", "Failed to start ForegroundService", e)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.i("ScrollTracker", "ScrollAccessibilityService destroyed")
        // Clear all states on destroy
        AppScreenStateTracker.clearAllStates()
        packageStates.clear()
        lastScrollDeltas.clear()
    }
}