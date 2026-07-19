/**
 * SwipeCounter - detects video changes based on ACTUAL SWIPES detected natively.
 *
 * This replaces the heuristic-based approach with direct swipe counting:
 * - If the native layer detected a swipe (swipeDirection = UP or DOWN)
 * - AND we're in VIDEO_FEED state (not COMMENTS_OPEN, not PROFILE, etc.)
 * - AND it's not a comment scroll
 * => Count it as a video change
 *
 * This is more accurate than heuristic-based counting because we're measuring
 * actual user input (swipes) rather than inferring from structural signals.
 *
 * The SwipeCounter is the PRIMARY method. SessionEstimator remains as a fallback
 * for backward compatibility and edge cases.
 */

import * as CommentScrollDetector from "./CommentScrollDetector";

/** @type {Record<string, {lastSwipeAt: number, videoCount: number, events: Array<{occurredAt: number, direction: string, appScreen: string}>}>} */
const sessionState = new Map();
// Semaphore to prevent race conditions on sessionState Map
// JavaScript is single-threaded per event loop, but this protects against re-entrancy
let isProcessing = false;
const pendingEvents = [];

/**
 * Process a native scroll event that may contain swipe information.
 * Only vertical swipes (UP/DOWN) count. Horizontal swipes are ignored.
 * Returns { videoDelta: 0|1, newEvent?: {...}, sessionEnded?: {...} }
 */
export function processSwipeEvent(event) {
  if (!event) return { videoDelta: 0 };
  
  // Queue if already processing to maintain order
  if (isProcessing) {
    pendingEvents.push(event);
    return { videoDelta: 0 };
  }

  return _processSwipeEventSynchronized(event);
}

/**
 * Internal: process event with synchronization
 */
function _processSwipeEventSynchronized(event) {
  isProcessing = true;
  try {
    const result = _handleSwipeEvent(event);
    
    // Process any queued events
    while (pendingEvents.length > 0) {
      const nextEvent = pendingEvents.shift();
      _handleSwipeEvent(nextEvent);
    }
    
    return result;
  } finally {
    isProcessing = false;
  }
}

/**
 * Internal: actual event handling logic (now synchronized)
 */
function _handleSwipeEvent(event) {
  const key = event.packageName;
  let state = sessionState.get(key);

  // Session lifecycle management
  if (event.eventType === "app_foreground") {
    if (!state) {
      state = {
        lastSwipeAt: event.timestamp,
        videoCount: 0,
        events: [],
      };
      sessionState.set(key, state);
    }
    return { videoDelta: 0 };
  }

  if (event.eventType === "app_background") {
    // Don't end immediately - timeouts are handled by the caller
    return { videoDelta: 0 };
  }

  if (!state) return { videoDelta: 0 };

  // Only count VERTICAL swipes (UP or DOWN) - ignore horizontal (LEFT/RIGHT)
  if (!event.swipeDirection || event.swipeDirection === "NONE" || event.swipeDirection === "LEFT" || event.swipeDirection === "RIGHT") {
    return { videoDelta: 0 };
  }

  // Must be UP or DOWN for valid video navigation
  if (event.swipeDirection !== "UP" && event.swipeDirection !== "DOWN") {
    return { videoDelta: 0 };
  }

  // Only count if we're in VIDEO_FEED (not COMMENTS_OPEN, PROFILE, SEARCH, etc.)
  if (event.appScreen !== "VIDEO_FEED") {
    return { videoDelta: 0 };
  }

  // Only count if it wasn't a comment scroll (double-checked by CommentScrollDetector)
  if (CommentScrollDetector.isLikelyCommentScroll(event)) {
    return { videoDelta: 0 };
  }

  // Prevent duplicate swipes within 300ms (prevents fast repeated swipes from counting twice)
  if (state.lastSwipeAt && (event.timestamp - state.lastSwipeAt) < 300) {
    return { videoDelta: 0 };
  }

  // We have a valid swipe - count it!
  state.videoCount += 1;
  state.lastSwipeAt = event.timestamp;

  const newEvent = {
    occurredAt: event.timestamp,
    direction: event.swipeDirection,
    appScreen: event.appScreen,
    confidence: 0.98, // Very high confidence: direct swipe detection
    detection: "swipe_direct",
  };
  state.events.push(newEvent);

  console.log("[v0] Valid vertical swipe detected:", event.swipeDirection, "- Total videos:", state.videoCount);
  return { videoDelta: 1, newEvent };
}

/**
 * Get the current session state for a package (for testing/debugging).
 */
export function getSessionState(packageName) {
  return sessionState.get(packageName);
}

/**
 * End a session (called externally when session times out or app closes).
 */
export function endSession(packageName, endedAt) {
  const state = sessionState.get(packageName);
  if (!state) return null;

  const result = {
    packageName,
    endedAt,
    videoCount: state.videoCount,
  };

  sessionState.delete(packageName);
  return result;
}

/**
 * Clear all sessions (for reset/testing).
 */
export function clearAllSessions() {
  sessionState.clear();
}



/**
 * Utility to merge SwipeCounter results with SessionEstimator results
 * (for transition period when both methods run in parallel).
 */
export function mergeResults(swipeResult, estimatorResult) {
  // Prefer swipe-based if available
  if (swipeResult && swipeResult.videoDelta > 0) {
    return swipeResult;
  }
  // Fall back to estimator
  return estimatorResult;
}
