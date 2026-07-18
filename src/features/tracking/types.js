/**
 * Shared shape documentation for tracking data. This project uses plain
 * JavaScript + JSDoc instead of TypeScript, so these typedefs exist purely
 * for editor autocomplete/hover-hints - they have no runtime effect.
 *
 * @typedef {"instagram_reels"|"youtube_shorts"|"tiktok"|"snapchat_spotlight"} PlatformKey
 *
 * @typedef {Object} Platform
 * @property {number} id
 * @property {PlatformKey} key
 * @property {string} displayName
 * @property {string} packageName
 * @property {string} colorHex
 *
 * @typedef {"scroll_gesture"|"view_id_change"|"content_desc_change"|"timer_heuristic"} DetectionMethod
 *
 * @typedef {Object} VideoEvent
 * @property {number} id
 * @property {number} sessionId
 * @property {number} occurredAt
 * @property {number} confidence
 * @property {DetectionMethod} detection
 *
 * @typedef {"accessibility"|"usage_stats_fallback"} SessionSource
 *
 * @typedef {Object} Session
 * @property {number} id
 * @property {number} platformId
 * @property {number} startedAt
 * @property {number|null} endedAt
 * @property {number|null} durationMs
 * @property {number} videoCount
 * @property {SessionSource} source
 * @property {string} dayBucket - 'YYYY-MM-DD'
 *
 * @typedef {Object} DailyStat
 * @property {string} dayBucket
 * @property {number} platformId
 * @property {number} totalVideos
 * @property {number} totalDurationMs
 * @property {number} sessionCount
 * @property {number} avgWatchMs
 *
 * @typedef {"video_count"|"time_ms"} GoalType
 *
 * @typedef {Object} Goal
 * @property {number} id
 * @property {number|null} platformId - null = combined goal across all platforms
 * @property {GoalType} goalType
 * @property {number} limitValue
 * @property {boolean} isActive
 * @property {number} createdAt
 *
 * @typedef {Object} FocusSession
 * @property {number} id
 * @property {number} startedAt
 * @property {number|null} endedAt
 * @property {number} plannedMs
 * @property {boolean} interrupted
 *
 * @typedef {Object} NativeScrollEvent
 * @property {string} packageName
 * @property {number} timestamp
 * @property {"window_state_changed"|"view_scrolled"|"content_changed"|"app_foreground"|"app_background"} eventType
 * @property {string} [viewIdHint] - resourceId of the changed node, when available
 * @property {string} [contentDescHint] - content-desc text, when available (no video text/captions)
 * @property {number} [scrollDeltaX] - raw AccessibilityEvent#getScrollDeltaX (API 28+ only)
 * @property {number} [scrollDeltaY] - raw AccessibilityEvent#getScrollDeltaY (API 28+ only)
 * @property {"UP"|"DOWN"|"NONE"} [swipeDirection] - derived in JS by SwipeDirection.js, not sent by native
 * @property {"VIDEO_FEED"|"COMMENTS_OPEN"|"PROFILE"|"SEARCH"|"OTHER"|"UNKNOWN"} [appScreen] - derived in JS by CommentScrollDetector.js, not sent by native
 */

// Nothing to export at runtime - this file exists for the JSDoc block above.
export {};