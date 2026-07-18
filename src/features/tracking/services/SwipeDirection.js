/**
 * SwipeDirection - turns the raw scrollDeltaY pixel offset (from
 * AccessibilityEvent#getScrollDeltaY, API 28+, see ScrollAccessibilityService.kt)
 * into a UP/DOWN/NONE direction SwipeCounter can act on.
 *
 * Convention: a full-page swipe in a vertical Reels/Shorts/TikTok-style feed
 * moves the container by roughly one screen height. Android reports a
 * *positive* scrollDeltaY when content scrolls down (the next item is
 * revealed at the bottom, i.e. the user swiped UP with their thumb), and
 * negative when the previous item is revealed (swiped DOWN). This matches
 * standard RecyclerView/ViewPager2 scroll-delta semantics.
 *
 * IMPORTANT - this threshold is calibrated for typical phone screens.
 * A full-page swipe usually moves ~1.5-3x the screen height in pixels.
 * We use a conservative threshold to catch both quick flicks and slower swipes.
 */

/** Minimum |scrollDeltaY| (raw px) to treat a scroll event as a full-page swipe rather than a minor in-content scroll adjustment. */
export const DEFAULT_SWIPE_THRESHOLD_PX = 200;

/**
 * @param {import("../types").NativeScrollEvent} event
 * @param {number} [thresholdPx]
 * @returns {"UP"|"DOWN"|"NONE"}
 */
export function deriveSwipeDirection(event, thresholdPx = DEFAULT_SWIPE_THRESHOLD_PX) {
  if (typeof event.scrollDeltaY !== "number" || event.scrollDeltaY === 0) {
    return "NONE"; // no delta reported (older Android, or non-view_scrolled event)
  }
  if (event.scrollDeltaY >= thresholdPx) return "UP";
  if (event.scrollDeltaY <= -thresholdPx) return "DOWN";
  return "NONE"; // moved, but too small to be a page swipe - likely a bounce or minor UI scroll
}
