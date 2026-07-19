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
 * @property {string} id - stable native event identity
 * @property {string} packageName
 * @property {number} timestamp
 * @property {"video_swipe"|"app_foreground"|"feed_visible"|"feed_hidden"} eventType
 * @property {"up"|"down"} [direction]
 * @property {"short_video_feed"} [appScreen]
 */

// Nothing to export at runtime - this file exists for the JSDoc block above.
export {};
