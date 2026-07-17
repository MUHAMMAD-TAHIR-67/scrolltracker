import { ScrollTrackerNative, subscribeToScrollEvents } from "../native/ScrollTrackerModule";
import { SessionEstimator } from "./SessionEstimator";
import { trackingRepository } from "../repository/TrackingRepository";
import { useTrackingStore } from "../store/trackingStore";
import { useFocusStore, notifyFocusModeBreach } from "@/features/focus/services/FocusModeService";

/**
 * Some apps ship different package IDs on different builds/regions. The
 * `platforms` table only stores one canonical package_name per platform
 * (see src/db/database.js), so any alternate package ID has to be mapped
 * back to the canonical one here before we look it up - otherwise events
 * from the alternate package are silently dropped in #handleEvent.
 *
 * Keep this in sync with SessionEstimator.js#resolvePlatformKey and the
 * trackedPackages sets in ScrollAccessibilityService.kt / TrackerForegroundService.kt.
 */
const PACKAGE_ALIASES = {
  "com.ss.android.ugc.trill": "com.zhiliaoapp.musically", // TikTok, alternate regional package id
};

function canonicalPackageName(packageName) {
  return PACKAGE_ALIASES[packageName] ?? packageName;
}

/**
 * App-side orchestrator. Subscribes to the native event emitter, feeds events
 * through SessionEstimator, persists results via the repository, and updates
 * the Zustand store for live UI. Also runs a periodic sweep to close idle
 * sessions and reconcile against UsageStatsManager as a sanity check.
 *
 * NOTE: TrackerForegroundService.kt keeps this process more likely to stay
 * alive and independently polls UsageStatsManager for excessive-scroll
 * notifications, but it does NOT write video events or sessions to SQLite.
 * All actual video-count persistence happens here, in JS, and only while
 * this runtime is alive - if the OS kills/freezes the process (e.g.
 * aggressive OEM battery managers), events pile up in the native ring
 * buffer (ScrollEventBus, capped at 500) and are only recovered via
 * drainPendingEvents() the next time this runtime starts. If you see
 * consistently missing videos even with all packages/aliases mapped
 * correctly, check whether the process is being killed while backgrounded.
 */
class TrackingServiceImpl {
  #estimator = new SessionEstimator();
  #unsubscribe = null;
  #sweepInterval = null;
  #platformsByPackage = new Map();
  #openSessionIds = new Map(); // packageName -> sessions.id

  async start() {
    const platforms = await trackingRepository.getPlatforms();
    platforms.forEach((p) => this.#platformsByPackage.set(p.packageName, p));

    try {
      await ScrollTrackerNative.startTrackingService();
    } catch (e) {
      console.warn("Failed to start tracking service:", e);
    }

    // Pick up anything the native ring buffer captured before JS attached.
    try {
      const pending = await ScrollTrackerNative.drainPendingEvents();
      for (const evt of pending) await this.#handleEvent(evt);
    } catch (e) {
      console.warn("Failed to drain pending events:", e);
    }

    this.#unsubscribe = subscribeToScrollEvents((evt) => this.#handleEvent(evt));

    this.#sweepInterval = setInterval(() => this.#sweep(), 10_000);
  }

  async stop() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#sweepInterval) clearInterval(this.#sweepInterval);
    try {
      await ScrollTrackerNative.stopTrackingService();
    } catch (e) {
      console.warn("Failed to stop tracking service:", e);
    }
  }

  /** @param {import("../types").NativeScrollEvent} event */
  async #handleEvent(rawEvent) {
    // Normalize alternate package IDs (e.g. TikTok's com.ss.android.ugc.trill)
    // to the canonical one stored in the platforms table.
    const event = { ...rawEvent, packageName: canonicalPackageName(rawEvent.packageName) };

    const platform = this.#platformsByPackage.get(event.packageName);
    if (!platform) return; // not a tracked app

    if (
      (event.eventType === "app_foreground" || event.eventType === "window_state_changed") &&
      !this.#openSessionIds.has(event.packageName)
    ) {
      const sessionId = await trackingRepository.openSession(platform.id, event.timestamp, "accessibility");
      this.#openSessionIds.set(event.packageName, sessionId);

      if (useFocusStore.getState().isActive) {
        notifyFocusModeBreach(platform.displayName).catch(() => {});
      }
    }

    const result = this.#estimator.ingest(event);

    if (result.newEvent) {
      const sessionId = this.#openSessionIds.get(event.packageName);
      if (sessionId) {
        await trackingRepository.appendVideoEvent(
          sessionId,
          result.newEvent.occurredAt,
          result.newEvent.confidence,
          result.newEvent.detection
        );
        useTrackingStore.getState().incrementLiveCount(platform.key);
      }
    }
  }

  async #sweep() {
    const now = Date.now();
    const closed = this.#estimator.sweepTimeouts(now);
    for (const c of closed) {
      const sessionId = this.#openSessionIds.get(c.packageName);
      if (sessionId) {
        await trackingRepository.closeSession(sessionId, c.endedAt);
        this.#openSessionIds.delete(c.packageName);
        useTrackingStore.getState().refreshToday();
      }
    }
  }
}

export const TrackingService = new TrackingServiceImpl();