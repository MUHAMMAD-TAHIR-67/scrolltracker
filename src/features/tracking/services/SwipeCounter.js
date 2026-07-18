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

/** @type {Record<string, {lastSwipeAt: number, videoCount: number, events: Array<{occurredAt: number, direction: string, appScreen: string}>}>} */
const sessionState = new Map();

/**
 * Process a native scroll event that may contain swipe information.
 * Returns { videoDelta: 0|1, newEvent?: {...}, sessionEnded?: {...} }
 */
export function processSwipeEvent(event) {
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

  // Only count actual swipes
  if (!event.swipeDirection || event.swipeDirection === "NONE") {
    return { videoDelta: 0 };
  }

  // Only count if we're in VIDEO_FEED (not COMMENTS_OPEN, PROFILE, SEARCH, etc.)
  if (event.appScreen !== "VIDEO_FEED") {
    return { videoDelta: 0 };
  }

  // Only count if it wasn't a comment scroll (double-checked by CommentScrollDetector)
  if (isCommentScroll(event)) {
    return { videoDelta: 0 };
  }

  // We have a valid swipe - count it!
  state.videoCount += 1;
  state.lastSwipeAt = event.timestamp;

  const newEvent = {
    occurredAt: event.timestamp,
    direction: event.swipeDirection,
    appScreen: event.appScreen,
    confidence: 0.95, // High confidence: we detected an actual swipe
    detection: "swipe_direct",
  };
  state.events.push(newEvent);

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
 * Helper: determine if a scroll event is likely inside the comments section.
 * This is a heuristic check as additional validation.
 */
function isCommentScroll(event) {
  // If appScreen is explicitly COMMENTS_OPEN, it's definitely a comment scroll
  if (event.appScreen === "COMMENTS_OPEN") {
    return true;
  }

  // Check for comment-related hints in the resource-id or content-description
  if (event.viewIdHint?.toLowerCase().includes("comment")) {
    return true;
  }

  if (event.contentDescHint?.toLowerCase().includes("comment")) {
    return true;
  }

  return false;
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
