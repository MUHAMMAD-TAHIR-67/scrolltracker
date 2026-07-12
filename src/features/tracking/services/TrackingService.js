import { ScrollTrackerNative, subscribeToScrollEvents } from "../native/ScrollTrackerModule";
import { SessionEstimator } from "./SessionEstimator";
import { trackingRepository } from "../repository/TrackingRepository";
import { useTrackingStore } from "../store/trackingStore";
import { useFocusStore, notifyFocusModeBreach } from "@/features/focus/services/FocusModeService";

/**
 * App-side orchestrator. Subscribes to the native event emitter, feeds events
 * through SessionEstimator, persists results via the repository, and updates
 * the Zustand store for live UI. Also runs a periodic sweep to close idle
 * sessions and reconcile against UsageStatsManager as a sanity check.
 *
 * A parallel, more resilient copy of this pipeline runs natively inside
 * TrackerForegroundService.kt so tracking survives the JS runtime being
 * killed; that native copy writes directly into the same SQLite file via
 * the same schema (see android/.../TrackerForegroundService.kt), and this
 * class simply picks up whatever happened while JS was alive for live UI.
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

    await ScrollTrackerNative.startTrackingService();

    // Pick up anything the native ring buffer captured before JS attached.
    const pending = await ScrollTrackerNative.drainPendingEvents();
    for (const evt of pending) await this.#handleEvent(evt);

    this.#unsubscribe = subscribeToScrollEvents((evt) => this.#handleEvent(evt));

    this.#sweepInterval = setInterval(() => this.#sweep(), 10_000);
  }

  async stop() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#sweepInterval) clearInterval(this.#sweepInterval);
    await ScrollTrackerNative.stopTrackingService();
  }

  /** @param {import("../types").NativeScrollEvent} event */
  async #handleEvent(event) {
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
