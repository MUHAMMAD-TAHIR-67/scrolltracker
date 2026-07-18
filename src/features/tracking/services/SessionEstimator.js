/**
 * SessionEstimator - orchestrates session lifecycle + video counting (hybrid: swipe-based
 * when native supplies it, structural-heuristic fallback otherwise - see ingest() below).
 *
 * VIDEO COUNTING: hybrid. SwipeCounter's direct-swipe detection is preferred whenever the
 * native layer provides swipeDirection + appScreen (it doesn't yet, as of this codebase -
 * see ingest()'s doc comment). Until then, #countStructural does the actual counting: it
 * debounces TYPE_VIEW_SCROLLED / TYPE_WINDOW_CONTENT_CHANGED by minDwellMs (so it isn't just
 * counting elapsed seconds off continuous UI-refresh events like progress bars/captions) and
 * filters out comment/profile/search scrolls via CommentScrollDetector.
 *
 * @typedef {Object} PlatformHeuristicProfile
 * @property {number} minDwellMs Minimum time between counted structural changes - used by #countStructural to reject bounce/overscroll noise.
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
import { deriveSwipeDirection } from "./SwipeDirection.js";

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
   * HYBRID COUNTING: SwipeCounter.processSwipeEvent needs event.swipeDirection +
   * event.appScreen === "VIDEO_FEED". Native (ScrollAccessibilityService.kt) doesn't
   * send those directly - it sends raw scrollDeltaX/Y pixel offsets (API 28+ only) plus
   * viewIdHint/contentDescHint. This method derives both fields in JS before handing
   * the event to SwipeCounter:
   *   - swipeDirection: SwipeDirection.js turns scrollDeltaY into UP/DOWN/NONE by sign
   *     and magnitude. Only available on API 28+ and only when the source view reports
   *     deltas, which is most modern feed containers but not guaranteed for all of
   *     Instagram/YouTube/TikTok/Snapchat's internal views.
   *   - appScreen: CommentScrollDetector.resolveAppScreen() classifies via keyword
   *     matching on viewIdHint/contentDescHint. This is a heuristic, not verified
   *     against these apps' actual internal resource-ids, and returns UNKNOWN for any
   *     event that carries no hint at all (common).
   * Because of those two heuristic gaps, the swipe path will legitimately miss real
   * swipes in practice. #countStructural (below) is the fallback that still counts
   * those misses via dwell-time debouncing, so nothing goes uncounted - it's just
   * lower-confidence than a resolved direct swipe. mergeResults() always prefers the
   * swipe result when it fires.
   * @param {import("../types").NativeScrollEvent} event
   * @returns {EstimatorResult}
   */
  ingest(event) {
    const profile = PLATFORM_PROFILES[this.#resolvePlatformKey(event.packageName)];
    if (!profile) return { videoDelta: 0 };

    // Session lifecycle bookkeeping (open/close state, lastEventAt for sweepTimeouts).
    this.#updateHeuristicState(event, profile);

    const enrichedEvent = {
      ...event,
      swipeDirection: deriveSwipeDirection(event),
      appScreen: CommentScrollDetector.resolveAppScreen(event),
    };

    const swipeResult = SwipeCounter.processSwipeEvent(enrichedEvent);
    const structuralResult = this.#countStructural(event, profile);

    return SwipeCounter.mergeResults(swipeResult, structuralResult);
  }

  /**
   * Structural fallback counter: currently the only path that actually produces
   * video counts, since native doesn't emit swipe/screen-state data yet (see
   * ingest() above). Debounces by dwell time and filters out comment/profile/
   * search scrolls via CommentScrollDetector so it isn't just a timer.
   * @private
   */
  #countStructural(event, profile) {
    const key = event.packageName;
    const state = this.#open.get(key);
    if (!state) return { videoDelta: 0 };

    const isStructural = event.eventType === "view_scrolled" || event.eventType === "content_changed";
    if (!isStructural) return { videoDelta: 0 };

    // Same comment-scroll filter the swipe path uses, so structural counting
    // doesn't inflate video counts while the user is reading comments.
    if (CommentScrollDetector.isLikelyCommentScroll(event)) {
      return { videoDelta: 0 };
    }

    const dwell = event.timestamp - state.lastStructuralEventAt;
    if (dwell < profile.minDwellMs) {
      // Too soon since the last counted change - likely a bounce/overscroll, not a new video.
      return { videoDelta: 0 };
    }

    const detection = event.viewIdHint
      ? "view_id_change"
      : event.contentDescHint
      ? "content_desc_change"
      : "scroll_gesture";
    // Slightly lower confidence than a direct swipe (0.95), since this is inferred.
    const confidence = detection === "view_id_change" ? 0.85 : detection === "content_desc_change" ? 0.75 : 0.5;

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