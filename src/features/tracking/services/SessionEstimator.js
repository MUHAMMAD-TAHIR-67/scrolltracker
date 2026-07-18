/**
 * SessionEstimator - NOW USES SWIPE-BASED COUNTING AS PRIMARY METHOD
 *
 * HYBRID APPROACH (Phase 1+2):
 * - SwipeCounter detects ACTUAL USER SWIPES from the native layer
 * - SessionEstimator remains as FALLBACK for backward compatibility
 * - Results prefer swipe-based over heuristic when both are available
 *
 * OLD BEHAVIOR (preserved as fallback):
 * Converts a stream of low-level NativeScrollEvents into "this looks like a new video" decisions.
 * This is a heuristic, not ground truth. Android's Accessibility API gives us
 * structural signals (view hierarchy changes, scroll events, content-desc changes)
 * but never a semantic "video index" the way an app's own player does internally.
 *
 * Detection signals, in order of trust:
 *  1. view_id_change   - the resource-id of the focused video container node changed
 *  2. content_desc_change - the accessibility content-description changed
 *  3. scroll_gesture    - a TYPE_VIEW_SCROLLED event fired (low confidence, paired with dwell-time)
 *  4. timer_heuristic   - fallback: elapsed time as evidence of additional videos
 *
 * @typedef {Object} PlatformHeuristicProfile
 * @property {number} minDwellMs Minimum ms a video must be on screen before a new scroll counts as a new video.
 * @property {number} loopGraceMs If no event arrives for this long, assume video is on loop (don't double count).
 * @property {number} averageVideoMs After this time with zero structural signal, treat as evidence of additional videos.
 * @property {number} sessionTimeoutMs Session ends after this much time backgrounded.
 *
 * @typedef {Object} EstimatorResult
 * @property {number} videoDelta
 * @property {{occurredAt: number, confidence: number, detection: import("../types").DetectionMethod}} [newEvent]
 * @property {{endedAt: number}} [sessionEnded]
 */

import * as SwipeCounter from "./SwipeCounter.js";
import * as CommentScrollDetector from "./CommentScrollDetector.js";

/** @type {Record<string, PlatformHeuristicProfile>} */
export const PLATFORM_PROFILES = {
  instagram_reels: { minDwellMs: 600, loopGraceMs: 15_000, averageVideoMs: 18_000, sessionTimeoutMs: 30_000 },
  youtube_shorts: { minDwellMs: 500, loopGraceMs: 12_000, averageVideoMs: 22_000, sessionTimeoutMs: 30_000 },
  tiktok: { minDwellMs: 500, loopGraceMs: 15_000, averageVideoMs: 20_000, sessionTimeoutMs: 30_000 },
  snapchat_spotlight: { minDwellMs: 600, loopGraceMs: 15_000, averageVideoMs: 16_000, sessionTimeoutMs: 30_000 },
};

export class SessionEstimator {
  /** @type {Map<string, {platformKey: string, startedAt: number, lastEventAt: number, lastStructuralEventAt: number, videoCount: number, events: Array<{occurredAt: number, confidence: number, detection: string}>}>} */
  #open = new Map();

  /**
   * Feed a single native event in. Returns what changed so the caller can persist it.
   * HYBRID: Prefers swipe-based counting, falls back to heuristics.
   * @param {import("../types").NativeScrollEvent} event
   * @returns {EstimatorResult}
   */
  ingest(event) {
    const profile = PLATFORM_PROFILES[this.#resolvePlatformKey(event.packageName)];
    if (!profile) return { videoDelta: 0 };

    // PRIMARY: Try swipe-based counting first (new native gesture detection)
    const swipeResult = SwipeCounter.processSwipeEvent(event);
    if (swipeResult && swipeResult.videoDelta > 0) {
      // Also update the heuristic state for session lifecycle management
      this.#updateHeuristicState(event, profile);
      // Log both methods for debugging/comparison
      const heuristicResult = this.#ingestHeuristic(event, profile);
      return { ...swipeResult, heuristicComparison: heuristicResult };
    }

    // FALLBACK: Use heuristic-based counting (old method)
    return this.#ingestHeuristic(event, profile);
  }

  /**
   * Internal: heuristic-based ingestion (legacy behavior).
   * @private
   */
  #ingestHeuristic(event, profile) {
    const key = event.packageName;
    let state = this.#open.get(key);

    if (event.eventType === "app_background" && state) {
      // Don't end immediately - give sessionTimeoutMs grace for quick app switches
      // (handled by the periodic sweep in `sweepTimeouts`).
      return { videoDelta: 0 };
    }

    if (!state) {
      if (event.eventType === "app_foreground" || event.eventType === "window_state_changed") {
        state = {
          platformKey: this.#resolvePlatformKey(event.packageName),
          startedAt: event.timestamp,
          lastEventAt: event.timestamp,
          lastStructuralEventAt: event.timestamp,
          videoCount: 0,
          events: [],
        };
        this.#open.set(key, state);
      }
      return { videoDelta: 0 };
    }

    state.lastEventAt = event.timestamp;
    const dwell = event.timestamp - state.lastStructuralEventAt;

    const isStructural = event.eventType === "view_scrolled" || event.eventType === "content_changed";
    if (!isStructural) return { videoDelta: 0 };

    if (dwell < profile.minDwellMs) {
      // Too soon since the last counted change - likely a bounce/overscroll, not a new video.
      return { videoDelta: 0 };
    }

    const detection = event.viewIdHint
      ? "view_id_change"
      : event.contentDescHint
      ? "content_desc_change"
      : "scroll_gesture";
    const confidence = detection === "view_id_change" ? 0.95 : detection === "content_desc_change" ? 0.85 : 0.6;

    state.videoCount += 1;
    state.lastStructuralEventAt = event.timestamp;
    const newEvent = { occurredAt: event.timestamp, confidence, detection };
    state.events.push(newEvent);

    return { videoDelta: 1, newEvent };
  }

  /**
   * Internal: update heuristic session state without counting (used during hybrid mode).
   * @private
   */
  #updateHeuristicState(event, profile) {
    const key = event.packageName;
    let state = this.#open.get(key);

    if (!state) {
      if (event.eventType === "app_foreground" || event.eventType === "window_state_changed") {
        state = {
          platformKey: this.#resolvePlatformKey(event.packageName),
          startedAt: event.timestamp,
          lastEventAt: event.timestamp,
          lastStructuralEventAt: event.timestamp,
          videoCount: 0,
          events: [],
        };
        this.#open.set(key, state);
      }
    } else {
      state.lastEventAt = event.timestamp;
    }
  }

  /**
   * Call on a ~10s interval (from the background task) to close sessions that have gone quiet.
   * Also notifies SwipeCounter to close its sessions.
   * @param {number} now
   * @returns {Array<{packageName: string, endedAt: number, videoCount: number}>}
   */
  sweepTimeouts(now) {
    const closed = [];
    for (const [pkg, state] of this.#open.entries()) {
      const profile = PLATFORM_PROFILES[state.platformKey];
      if (!profile) {
        // Unknown platform - clean up anyway
        this.#open.delete(pkg);
        SwipeCounter.endSession(pkg, state.lastEventAt);
        continue;
      }
      if (now - state.lastEventAt > profile.sessionTimeoutMs) {
        closed.push({ packageName: pkg, endedAt: state.lastEventAt, videoCount: state.videoCount });
        this.#open.delete(pkg);
        // Also end the SwipeCounter session
        SwipeCounter.endSession(pkg, state.lastEventAt);
      }
    }
    return closed;
  }

  /** @param {string} packageName @returns {string} */
  #resolvePlatformKey(packageName) {
    switch (packageName) {
      case "com.instagram.android":
        return "instagram_reels";
      case "com.google.android.youtube":
        return "youtube_shorts";
      case "com.zhiliaoapp.musically":
      case "com.ss.android.ugc.trill":
        return "tiktok";
      case "com.snapchat.android":
        return "snapchat_spotlight";
      default:
        return "";
    }
  }
}
