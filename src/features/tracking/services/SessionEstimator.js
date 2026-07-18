/**
 * SessionEstimator - orchestrates session lifecycle + delegates video counting to SwipeCounter.
 *
 * VIDEO COUNTING: swipe-only. A video is counted if and only if SwipeCounter detects
 * an actual vertical swipe while in VIDEO_FEED state, outside comments. See ingest() below.
 *
 * This class itself no longer counts videos from dwell-time/structural-event heuristics -
 * that approach counted TYPE_WINDOW_CONTENT_CHANGED events that fire continuously during
 * normal playback (progress bar, captions, etc.), which behaved like a timer rather than
 * a swipe detector. It's kept only for session open/close bookkeeping.
 *
 * @typedef {Object} PlatformHeuristicProfile
 * @property {number} minDwellMs Unused for counting now; kept for the deprecated #ingestHeuristic reference method.
 * @property {number} loopGraceMs If no event arrives for this long, assume video is on loop (don't double count).
 * @property {number} averageVideoMs Unused - video counting never estimates from elapsed time.
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
   *
   * VIDEO COUNTING IS SWIPE-ONLY: per the project's counting formula, a video is only
   * ever counted on a detected vertical swipe (SwipeCounter.processSwipeEvent), while
   * in VIDEO_FEED state, outside comments. The old dwell-time heuristic below
   * (#ingestHeuristic) is kept ONLY for session lifecycle bookkeeping (open/close,
   * lastEventAt) - it must never itself produce a videoDelta, since
   * TYPE_WINDOW_CONTENT_CHANGED fires continuously during normal video playback
   * (progress bar, captions, like-count animations, etc.) for reasons that have
   * nothing to do with the user swiping. Counting on that event, once dwell time
   * had elapsed, was effectively counting elapsed seconds rather than thumb movement.
   * @param {import("../types").NativeScrollEvent} event
   * @returns {EstimatorResult}
   */
  ingest(event) {
    const profile = PLATFORM_PROFILES[this.#resolvePlatformKey(event.packageName)];
    if (!profile) return { videoDelta: 0 };

    // Session lifecycle bookkeeping only - never increments videoCount itself.
    this.#updateHeuristicState(event, profile);

    // Source of truth for video counting: an actual detected swipe.
    return SwipeCounter.processSwipeEvent(event);
  }

  /**
   * @deprecated No longer used to produce video counts - see ingest() above.
   * Left in place only as a reference/debug utility; not called from ingest().
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