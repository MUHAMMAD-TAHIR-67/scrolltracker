package com.scrolltracker

import android.view.accessibility.AccessibilityEvent
import android.util.Log

/**
 * AppScreenStateTracker maintains an explicit state machine for each tracked app.
 *
 * States:
 * - OUTSIDE_APP: Not in a tracked app
 * - VIDEO_FEED: Main feed (e.g., Instagram Reels, TikTok, YouTube Shorts)
 * - COMMENTS_OPEN: Comments panel is visible and user can scroll it
 * - PROFILE: User/profile screen
 * - SEARCH: Search or explore screen
 * - UNKNOWN: In app but can't determine screen
 *
 * State transitions are driven by:
 * 1. Resource-id patterns (view hierarchy hints)
 * 2. Content-description keywords
 * 3. Accessibility event types (window state changes signal screen transitions)
 *
 * PRIVACY NOTE: We use only resource-ids and brief content-desc hints,
 * never full text or rendered content.
 */
object AppScreenStateTracker {

    // Platform-specific resource-id patterns
    private val platformPatterns = mapOf(
        "com.instagram.android" to InstagramPatterns(),
        "com.zhiliaoapp.musically" to TikTokPatterns(),
        "com.ss.android.ugc.trill" to TikTokPatterns(),
        "com.google.android.youtube" to YouTubePatterns(),
        "com.snapchat.android" to SnapchatPatterns()
    )

    // Per-package state tracking
    private val states = mutableMapOf<String, String>()

    /**
     * Update state based on an accessibility event.
     * Returns the current state for the package.
     */
    fun updateState(
        packageName: String,
        event: AccessibilityEvent
    ): String {
        val patterns = platformPatterns[packageName] ?: return "UNKNOWN"

        // On window state changes, we might be on a new screen
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val newState = detectScreenFromViewHierarchy(packageName, event, patterns)
            states[packageName] = newState
            return newState
        }

        // For other events, check if we should refine the state
        val currentState = states[packageName] ?: "UNKNOWN"

        // If we're on VIDEO_FEED, check if comments panel is now visible
        if (currentState == "VIDEO_FEED" && event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            if (isCommentsPanelVisible(packageName, event, patterns)) {
                states[packageName] = "COMMENTS_OPEN"
                return "COMMENTS_OPEN"
            }
        }

        // If we're on COMMENTS_OPEN and the comments panel is gone, revert to VIDEO_FEED
        if (currentState == "COMMENTS_OPEN" && event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            if (!isCommentsPanelVisible(packageName, event, patterns)) {
                states[packageName] = "VIDEO_FEED"
                return "VIDEO_FEED"
            }
        }

        return currentState
    }

    /**
     * Get the current state for a package without updating it.
     */
    fun getState(packageName: String): String {
        return states[packageName] ?: "UNKNOWN"
    }

    /**
     * Clear state for a package (called on app backgrounding, etc.).
     */
    fun clearState(packageName: String) {
        states.remove(packageName)
    }

    /**
     * Detect the current screen by inspecting the view hierarchy hints.
     */
    private fun detectScreenFromViewHierarchy(
        packageName: String,
        event: AccessibilityEvent,
        patterns: PlatformPatterns
    ): String {
        val viewIdHint = try {
            event.source?.viewIdResourceName
        } catch (_: Exception) {
            null
        }

        val contentDescHint = event.contentDescription?.toString()?.lowercase()

        return when {
            // Check for video feed indicators
            viewIdHint?.contains(patterns.feedResourcePattern) == true -> "VIDEO_FEED"
            contentDescHint?.contains("feed") == true -> "VIDEO_FEED"
            contentDescHint?.contains("reels") == true -> "VIDEO_FEED"
            contentDescHint?.contains("shorts") == true -> "VIDEO_FEED"

            // Check for profile
            viewIdHint?.contains(patterns.profileResourcePattern) == true -> "PROFILE"
            contentDescHint?.contains("profile") == true -> "PROFILE"
            contentDescHint?.contains("account") == true -> "PROFILE"

            // Check for search
            viewIdHint?.contains(patterns.searchResourcePattern) == true -> "SEARCH"
            contentDescHint?.contains("search") == true -> "SEARCH"
            contentDescHint?.contains("explore") == true -> "SEARCH"

            // Check for comments
            contentDescHint?.contains("comment") == true -> "COMMENTS_OPEN"

            else -> "UNKNOWN"
        }
    }

    /**
     * Detect if the comments panel is currently visible and scrollable.
     */
    private fun isCommentsPanelVisible(
        packageName: String,
        event: AccessibilityEvent,
        patterns: PlatformPatterns
    ): Boolean {
        try {
            val contentDescHint = event.contentDescription?.toString()?.lowercase() ?: return false
            val viewIdHint = try {
                event.source?.viewIdResourceName?.lowercase()
            } catch (_: Exception) {
                null
            }

            return contentDescHint.contains("comment") ||
                    viewIdHint?.contains("comment") == true ||
                    viewIdHint?.contains(patterns.commentsPanelResourcePattern) == true
        } catch (e: Exception) {
            return false
        }
    }

    /**
     * Clear all states (called on service disconnect, etc.).
     */
    fun clearAllStates() {
        states.clear()
    }
}

/**
 * Platform-specific resource-id patterns.
 */
sealed class PlatformPatterns {
    abstract val feedResourcePattern: String
    abstract val profileResourcePattern: String
    abstract val searchResourcePattern: String
    abstract val commentsPanelResourcePattern: String
}

class InstagramPatterns : PlatformPatterns() {
    override val feedResourcePattern = "clips_feed|reels_feed"
    override val profileResourcePattern = "profile"
    override val searchResourcePattern = "explore|search"
    override val commentsPanelResourcePattern = "comment"
}

class TikTokPatterns : PlatformPatterns() {
    override val feedResourcePattern = "main_feed|feed"
    override val profileResourcePattern = "profile|user_info"
    override val searchResourcePattern = "discover|search"
    override val commentsPanelResourcePattern = "comment"
}

class YouTubePatterns : PlatformPatterns() {
    override val feedResourcePattern = "shorts_feed|feed"
    override val profileResourcePattern = "account|channel"
    override val searchResourcePattern = "search"
    override val commentsPanelResourcePattern = "comment"
}

class SnapchatPatterns : PlatformPatterns() {
    override val feedResourcePattern = "story_feed|feed"
    override val profileResourcePattern = "profile"
    override val searchResourcePattern = "search|discover"
    override val commentsPanelResourcePattern = "comment"
}
