/**
 * SwipeCounter — counts videos based on ACTUAL vertical swipes detected natively.
 *
 * Rules:
 *  - Only UP or DOWN swipes count (LEFT/RIGHT are ignored).
 *  - Only counts when appScreen === "VIDEO_FEED" (comments, profile, search: ignored).
 *  - Minimum 300 ms between counted swipes to prevent double-counting a single flick.
 *  - CommentScrollDetector is applied as a secondary filter.
 */

import * as CommentScrollDetector from "./CommentScrollDetector";

/** @type {Map<string, {lastSwipeAt: number, videoCount: number, events: Array}>} */
const sessionState = new Map();

let isProcessing = false;
const pendingEvents = [];

export function processSwipeEvent(event) {
  if (!event) return { videoDelta: 0 };
  if (isProcessing) {
    pendingEvents.push(event);
    return { videoDelta: 0 };
  }
  return _processSync(event);
}

function _processSync(event) {
  isProcessing = true;
  try {
    const result = _handle(event);
    while (pendingEvents.length > 0) {
      _handle(pendingEvents.shift());
    }
    return result;
  } finally {
    isProcessing = false;
  }
}

function _handle(event) {
  const key = event.packageName;
  let state = sessionState.get(key);

  if (event.eventType === "app_foreground") {
    if (!state) {
      sessionState.set(key, { lastSwipeAt: event.timestamp, videoCount: 0, events: [] });
    }
    return { videoDelta: 0 };
  }

  if (event.eventType === "app_background") {
    return { videoDelta: 0 };
  }

  if (!state) return { videoDelta: 0 };

  // Only vertical swipes
  const dir = event.swipeDirection;
  if (!dir || dir === "NONE" || dir === "LEFT" || dir === "RIGHT") {
    return { videoDelta: 0 };
  }
  if (dir !== "UP" && dir !== "DOWN") {
    return { videoDelta: 0 };
  }

  // Must be in the video feed (not comments, profile, search)
  if (event.appScreen !== "VIDEO_FEED") {
    return { videoDelta: 0 };
  }

  // Secondary comment filter
  if (CommentScrollDetector.isLikelyCommentScroll(event)) {
    return { videoDelta: 0 };
  }

  // Debounce: minimum 300 ms between counted swipes
  if (state.lastSwipeAt && event.timestamp - state.lastSwipeAt < 300) {
    return { videoDelta: 0 };
  }

  // Valid swipe — count it
  state.videoCount += 1;
  state.lastSwipeAt = event.timestamp;

  const newEvent = {
    occurredAt: event.timestamp,
    direction: dir,
    appScreen: event.appScreen,
    confidence: 0.98,
    detection: "swipe_direct",
  };
  state.events.push(newEvent);

  return { videoDelta: 1, newEvent };
}

export function getSessionState(packageName) {
  return sessionState.get(packageName);
}

export function endSession(packageName, endedAt) {
  const state = sessionState.get(packageName);
  if (!state) return null;
  const result = { packageName, endedAt, videoCount: state.videoCount };
  sessionState.delete(packageName);
  return result;
}

export function clearAllSessions() {
  sessionState.clear();
}

export function mergeResults(swipeResult, estimatorResult) {
  if (swipeResult && swipeResult.videoDelta > 0) return swipeResult;
  return estimatorResult;
}
