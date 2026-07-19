package com.scrolltracker

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import com.anonymous.scrolltracker.BuildConfig
import android.util.Log
import kotlin.math.abs

/** Emits only conservative, canonical vertical short-video page transitions. */
class ScrollAccessibilityService : AccessibilityService() {
    private val trackedPackages = setOf(
        "com.instagram.android", "com.google.android.youtube",
        "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.snapchat.android"
    )
    private val lastCountAt = mutableMapOf<String, Long>()
    private val lastDirection = mutableMapOf<String, String>()
    private var foregroundPackage: String? = null

    override fun onCreate() {
        super.onCreate()
        ScrollEventBus.init(applicationContext)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val packageName = event.packageName?.toString() ?: return
        if (packageName !in trackedPackages) return
        val now = event.eventTime.takeIf { it > 0 } ?: System.currentTimeMillis()

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            foregroundPackage = packageName
            ScrollEventBus.publish(ScrollEventBus.Event(
                packageName = packageName, timestamp = now, eventType = "app_foreground"
            ))
            return
        }
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED || foregroundPackage != packageName) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return

        val viewId = try { event.source?.viewIdResourceName.orEmpty().lowercase() } catch (_: Exception) { "" }
        val className = event.className?.toString().orEmpty().lowercase()
        val description = event.contentDescription?.toString().orEmpty().lowercase()
        val screenHints = "$viewId $className $description"

        if (COMMENT_HINTS.any(screenHints::contains)) {
            ScrollEventBus.publish(ScrollEventBus.Event(packageName = packageName, timestamp = now, eventType = "feed_hidden"))
            return
        }
        if (!isSupportedFeed(packageName, screenHints)) return
        ScrollEventBus.publish(ScrollEventBus.Event(packageName = packageName, timestamp = now, eventType = "feed_visible"))

        val dx = event.scrollDeltaX
        val dy = event.scrollDeltaY
        val vertical = abs(dy)
        if (vertical < MIN_VERTICAL_DELTA || vertical <= abs(dx) * 2) return

        val direction = if (dy > 0) "up" else "down"
        val previousAt = lastCountAt[packageName] ?: 0L
        if (now - previousAt < DUPLICATE_WINDOW_MS) return
        // A rapid opposite callback is usually overscroll/bounce, not another page.
        if (lastDirection[packageName] != null && lastDirection[packageName] != direction && now - previousAt < BOUNCE_WINDOW_MS) return

        lastCountAt[packageName] = now
        lastDirection[packageName] = direction
        ScrollEventBus.publish(ScrollEventBus.Event(
            packageName = packageName,
            timestamp = now,
            eventType = "video_swipe",
            direction = direction,
            appScreen = "short_video_feed"
        ))
    }

    private fun isSupportedFeed(packageName: String, hints: String): Boolean {
        val packageHints = when (packageName) {
            "com.instagram.android" -> listOf("reel", "clips", "recycler")
            "com.google.android.youtube" -> listOf("short", "reel", "recycler")
            "com.zhiliaoapp.musically", "com.ss.android.ugc.trill" -> listOf("feed", "aweme", "viewpager", "recycler")
            "com.snapchat.android" -> listOf("spotlight", "viewpager", "recycler")
            else -> emptyList()
        }
        return packageHints.any(hints::contains)
    }

    override fun onInterrupt() {
        if (BuildConfig.DEBUG) Log.w("ScrollTracker", "Accessibility service interrupted")
    }

    companion object {
        private const val MIN_VERTICAL_DELTA = 120
        private const val DUPLICATE_WINDOW_MS = 650L
        private const val BOUNCE_WINDOW_MS = 1200L
        private val COMMENT_HINTS = listOf("comment", "reply", "bottom_sheet", "dialog", "chat")
    }
}
