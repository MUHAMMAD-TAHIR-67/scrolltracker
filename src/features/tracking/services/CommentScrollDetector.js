/**
 * CommentScrollDetector - analyzes scroll events to classify them as:
 * - VIDEO_SCROLL: user is scrolling through the main feed (valid for video count)
 * - COMMENT_SCROLL: user is scrolling within the comments panel (should NOT count as video)
 * - OTHER_SCROLL: scrolling in profile, search, settings, etc.
 *
 * This works alongside AppScreenStateTracker (native) to prevent false video counts
 * when users are interacting with comments, likes, or other UI elements.
 *
 * The detector uses heuristics since the Accessibility API doesn't give us
 * full UI hierarchy, but it's conservative: when in doubt, don't count.
 */

const COMMENT_KEYWORDS = [
  "comment",
  "reply",
  "response",
  "feedback",
  "discuss",
  "message",
  "chat",
  "conversation",
];

const VIDEO_FEED_KEYWORDS = [
  "feed",
  "reels",
  "shorts",
  "video",
  "home",
  "timeline",
  "discover",
];

const PROFILE_KEYWORDS = ["profile", "avatar", "bio", "following", "followers"];

const SEARCH_KEYWORDS = ["search", "explore", "hashtag", "query"];

/**
 * Analyze a scroll event to determine if it's likely a comment scroll.
 * Returns true if we believe the user was scrolling in a comments panel.
 */
export function isLikelyCommentScroll(event) {
  // Trust the native appScreen field first (most reliable)
  if (event.appScreen === "COMMENTS_OPEN") {
    return true;
  }

  // Check resource-id hints
  if (event.viewIdHint) {
    const viewIdLower = event.viewIdHint.toLowerCase();
    if (COMMENT_KEYWORDS.some((kw) => viewIdLower.includes(kw))) {
      return true;
    }
  }

  // Check content-description hints
  if (event.contentDescHint) {
    const descLower = event.contentDescHint.toLowerCase();
    if (COMMENT_KEYWORDS.some((kw) => descLower.includes(kw))) {
      return true;
    }
    // Also check for negative indicators (not in a feed context)
    if (!VIDEO_FEED_KEYWORDS.some((kw) => descLower.includes(kw))) {
      // If it doesn't mention feed/video/home, it might be in a different screen
      if (descLower.includes("scroll") || descLower.includes("panel")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Classify a scroll event using only viewIdHint/contentDescHint keyword
 * matching - it does NOT read event.appScreen (that field is derived FROM
 * this function via resolveAppScreen() below, not the other way around;
 * this function previously read event.appScreen here, which nothing ever
 * set, so it silently fell through to UNKNOWN_SCROLL for every non-comment
 * event).
 */
export function classifyScrollEvent(event) {
  if (isLikelyCommentScroll(event)) {
    return "COMMENT_SCROLL";
  }

  const viewIdLower = event.viewIdHint?.toLowerCase() ?? "";
  const descLower = event.contentDescHint?.toLowerCase() ?? "";

  if (VIDEO_FEED_KEYWORDS.some((kw) => viewIdLower.includes(kw) || descLower.includes(kw))) {
    return "VIDEO_SCROLL";
  }

  if (
    PROFILE_KEYWORDS.some((kw) => viewIdLower.includes(kw) || descLower.includes(kw)) ||
    SEARCH_KEYWORDS.some((kw) => viewIdLower.includes(kw) || descLower.includes(kw))
  ) {
    return "OTHER_SCROLL";
  }

  // No positive keyword match either way - conservative: don't count as video.
  // In practice this fires often, since a lot of real scroll events carry no
  // resource-id/content-desc hint at all (Android only attaches one when the
  // app itself sets it). That's expected: the structural fallback in
  // SessionEstimator.js#countStructural is what catches those, not this path.
  return "UNKNOWN_SCROLL";
}

/**
 * Maps classifyScrollEvent's label onto the appScreen values SwipeCounter.js
 * expects. This is what SessionEstimator calls to derive event.appScreen
 * before handing the event to SwipeCounter - see SessionEstimator.js#ingest.
 * @param {import("../types").NativeScrollEvent} event
 * @returns {"VIDEO_FEED"|"COMMENTS_OPEN"|"OTHER"|"UNKNOWN"}
 */
export function resolveAppScreen(event) {
  switch (classifyScrollEvent(event)) {
    case "VIDEO_SCROLL":
      return "VIDEO_FEED";
    case "COMMENT_SCROLL":
      return "COMMENTS_OPEN";
    case "OTHER_SCROLL":
      return "OTHER";
    default:
      return "UNKNOWN";
  }
}

/**
 * Utility: safely check for keyword matches in text (null-safe).
 */
function textContainsKeyword(text, keywords) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}