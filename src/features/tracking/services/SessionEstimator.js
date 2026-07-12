/**
 * SessionEstimator - converts a stream of low-level NativeScrollEvents into
 * "this looks like a new video" decisions.
 *
 * This is a heuristic, not ground truth. Android's Accessibility API gives us
 * structural signals (view hierarchy changes, scroll events, content-desc
 * changes) but never a semantic "video index" the way an app's own player
 * does internally. See the README section "Estimation accuracy & limits"
 * for the accuracy tradeoffs this encodes.
 *
 * Detection signals, in order of trust:
 *  1. view_id_change   - the resource-id of the focused video container node
 *                         changed (e.g. RecyclerView child index / ViewPager
 *                         page id). Highest confidence.
 *  2. content_desc_change - the accessibility content-description of the
 *                         foreground video node changed (many players expose
 *                         a per-item content-desc for a11y readers, without
 *                         exposing caption text to us). Medium confidence.
 *  3. scroll_gesture    - a TYPE_VIEW_SCROLLED event fired inside the known
 *                         short-form surface. Low confidence alone (a user
 *                         can scroll without a full page change, e.g.
 *                         dragging a comment sheet) so it's paired with a
 *                         minimum-dwell-time gate.
 *  4. timer_heuristic   - fallback: if no structural event fires for
 *                         `assumedMaxWatchMs`, we assume the user is still
 *                         watching the same video (looped) OR count it as a
 *                         new implicit video, depending on platform profile.
 *
 * @typedef {Object} PlatformHeuristicProfile
 * @property {number} minDwellMs Minimum ms a video must be on screen before a new scroll counts as a new video (filters flick-back/undo gestures).
 * @property {number} loopGraceMs If no event arrives for this long during an open session, assume video is on loop and DON'T double count.
 * @property {number} averageVideoMs After this much foreground time with zero structural signal, treat elapsed time as evidence of additional (uncounted) videos, purely for the estimated-count fallback.
 * @property {number} sessionTimeoutMs Session is considered ended after this much time with the app fully backgrounded / screen off.
 *
 * @typedef {Object} EstimatorResult
 * @property {number} videoDelta
 * @property {{occurredAt: number, confidence: number, detection: import("../types").DetectionMethod}} [newEvent]
 * @property {{endedAt: number}} [sessionEnded]
 */

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
   * @param {import("../types").NativeScrollEvent} event
   * @returns {EstimatorResult}
   */
  ingest(event) {
    const profile = PLATFORM_PROFILES[this.#resolvePlatformKey(event.packageName)];
    if (!profile) return { videoDelta: 0 };

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
   * Call on a ~10s interval (from the background task) to close sessions that have gone quiet.
   * @param {number} now
   * @returns {Array<{packageName: string, endedAt: number, videoCount: number}>}
   */
  sweepTimeouts(now) {
    const closed = [];
    for (const [pkg, state] of this.#open.entries()) {
      const profile = PLATFORM_PROFILES[state.platformKey];
      if (now - state.lastEventAt > profile.sessionTimeoutMs) {
        closed.push({ packageName: pkg, endedAt: state.lastEventAt, videoCount: state.videoCount });
        this.#open.delete(pkg);
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
