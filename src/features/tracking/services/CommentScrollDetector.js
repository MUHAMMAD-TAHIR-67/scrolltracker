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
 * Get a classification label for a scroll event for logging/debugging.
 */
export function classifyScrollEvent(event) {
  if (isLikelyCommentScroll(event)) {
    return "COMMENT_SCROLL";
  }

  if (event.appScreen === "VIDEO_FEED") {
    return "VIDEO_SCROLL";
  }

  if (event.appScreen === "PROFILE" || event.appScreen === "SEARCH") {
    return "OTHER_SCROLL";
  }

  // Unknown context - conservative: don't count
  return "UNKNOWN_SCROLL";
}

/**
 * Utility: safely check for keyword matches in text (null-safe).
 */
function textContainsKeyword(text, keywords) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}
