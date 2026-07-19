import { ScrollTrackerNative, subscribeToScrollEvents } from "../native/ScrollTrackerModule";
import { SessionEstimator } from "./SessionEstimator";
import { trackingRepository } from "../repository/TrackingRepository";
import { useTrackingStore } from "../store/trackingStore";
import { useFocusStore, notifyFocusModeBreach } from "@/features/focus/services/FocusModeService";

const PACKAGE_ALIASES = {
  "com.ss.android.ugc.trill": "com.zhiliaoapp.musically", // TikTok alternate package
};

function canonicalPackageName(packageName) {
  return PACKAGE_ALIASES[packageName] ?? packageName;
}

const FOREGROUND_DEBOUNCE_MS = 2000;

class TrackingServiceImpl {
  #estimator = new SessionEstimator();
  #unsubscribe = null;
  #sweepInterval = null;
  #platformsByPackage = new Map();
  #openSessionIds = new Map(); // packageName -> sessionId
  #lastForegroundTime = new Map();
  #errorCount = 0;
  #MAX_ERRORS = 10;

  async start() {
    try {
      if (this.#unsubscribe !== null) return; // already running

      const platforms = await trackingRepository.getPlatforms();
      if (!platforms || platforms.length === 0) return;
      platforms.forEach((p) => this.#platformsByPackage.set(p.packageName, p));

      // Start the native foreground service
      try {
        await ScrollTrackerNative.startTrackingService?.();
      } catch (_) {}

      // Drain any events that piled up while JS was not running
      try {
        const pending = await ScrollTrackerNative.drainPendingEvents?.();
        if (Array.isArray(pending)) {
          for (const evt of pending) {
            if (evt) await this.#handleEvent(evt).catch(() => {});
          }
        }
        await ScrollTrackerNative.resetNativeTracking?.().catch(() => {});
      } catch (_) {}

      // Subscribe to live events
      this.#unsubscribe = subscribeToScrollEvents((evt) => {
        if (evt && this.#unsubscribe !== null) {
          this.#handleEvent(evt).catch(() => {});
        }
      });

      // Periodic sweep to close idle sessions
      this.#sweepInterval = setInterval(
        () => this.#sweep().catch(() => {}),
        10_000
      );
    } catch (_) {}
  }

  async stop() {
    try {
      if (this.#unsubscribe) {
        this.#unsubscribe();
        this.#unsubscribe = null;
      }
      if (this.#sweepInterval) {
        clearInterval(this.#sweepInterval);
        this.#sweepInterval = null;
      }
      try {
        await ScrollTrackerNative.stopTrackingService?.();
      } catch (_) {}
    } catch (_) {}
  }

  async #handleEvent(rawEvent) {
    if (!rawEvent || typeof rawEvent !== "object") return;

    const event = {
      ...rawEvent,
      packageName: canonicalPackageName(rawEvent.packageName),
    };

    // If service is stopped ignore everything except app_background
    if (this.#unsubscribe === null && event.eventType !== "app_background") return;

    const platform = this.#platformsByPackage.get(event.packageName);
    if (!platform) return;

    try {
      // Open a session when the app comes to foreground
      if (
        event.eventType === "app_foreground" ||
        event.eventType === "window_state_changed"
      ) {
        const now = event.timestamp;
        const last = this.#lastForegroundTime.get(event.packageName) ?? 0;
        if (now - last < FOREGROUND_DEBOUNCE_MS) return;
        this.#lastForegroundTime.set(event.packageName, now);

        if (!this.#openSessionIds.has(event.packageName)) {
          const sessionId = await trackingRepository.openSession(
            platform.id,
            event.timestamp,
            "accessibility"
          );
          if (sessionId > 0) {
            this.#openSessionIds.set(event.packageName, sessionId);
            const focusState = useFocusStore?.getState?.();
            if (focusState?.isActive) {
              notifyFocusModeBreach(platform.displayName).catch(() => {});
            }
          }
        }
      }

      // Feed the event through the estimator (handles swipe detection + fallback)
      const result = this.#estimator?.ingest?.(event);
      if (!result) return;

      // Persist a valid video event
      if (result.newEvent && result.videoDelta > 0) {
        const sessionId = this.#openSessionIds.get(event.packageName);
        if (sessionId && sessionId > 0) {
          const eventId = await trackingRepository.appendVideoEvent(
            sessionId,
            result.newEvent.occurredAt,
            result.newEvent.confidence,
            result.newEvent.detection,
            {
              swipeDirection: result.newEvent.direction ?? null,
              appScreenState: result.newEvent.appScreen ?? null,
              detectionSource:
                result.newEvent.detection === "swipe_direct" ? "swipe" : "heuristic",
            }
          );
          if (eventId > 0) {
            useTrackingStore?.getState?.()?.incrementLiveCount?.(platform.key);
          }
        }
      }

      this.#errorCount = 0;
    } catch (error) {
      this.#errorCount++;
      if (this.#errorCount <= this.#MAX_ERRORS) {
        // Silently swallow — individual event errors must not crash the service
      }
    }
  }

  async #sweep() {
    if (this.#unsubscribe === null) return;
    const now = Date.now();
    const closed = this.#estimator?.sweepTimeouts?.(now) ?? [];
    for (const c of closed) {
      if (!c?.packageName) continue;
      const sessionId = this.#openSessionIds.get(c.packageName);
      if (sessionId) {
        try {
          await trackingRepository.closeSession(sessionId, c.endedAt);
        } catch (_) {}
        this.#openSessionIds.delete(c.packageName);
        useTrackingStore?.getState?.()?.refreshToday?.();
      }
    }
  }
}

export const TrackingService = new TrackingServiceImpl();
