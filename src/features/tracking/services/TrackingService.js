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
    try {
      if (this.#unsubscribe !== null) {
        console.warn("[v0] TrackingService already started, skipping");
        return;
      }

      const platforms = await trackingRepository.getPlatforms();
      if (!platforms || platforms.length === 0) {
        console.warn("[v0] No platforms found, cannot start tracking");
        return;
      }
      platforms.forEach((p) => this.#platformsByPackage.set(p.packageName, p));

      try {
        await ScrollTrackerNative?.startTrackingService?.();
      } catch (e) {
        console.warn("[v0] Failed to start tracking service:", e?.message);
      }

      // Pick up anything the native ring buffer captured before JS attached.
      try {
        const pending = await ScrollTrackerNative?.drainPendingEvents?.();
        if (pending && Array.isArray(pending)) {
          for (const evt of pending) {
            if (evt) await this.#handleEvent(evt).catch((err) => console.warn("[v0] Error handling pending event:", err));
          }
        }
      } catch (e) {
        console.warn("[v0] Failed to drain pending events:", e?.message);
      }

      this.#unsubscribe = subscribeToScrollEvents((evt) => {
        if (evt && this.#unsubscribe !== null) {
          this.#handleEvent(evt).catch((err) => console.warn("[v0] Error handling event:", err));
        }
      });

      this.#sweepInterval = setInterval(() => this.#sweep().catch((err) => console.warn("[v0] Sweep error:", err)), 10_000);
      console.log("[v0] TrackingService started successfully");
    } catch (error) {
      console.error("[v0] Failed to start TrackingService:", error?.message);
    }
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
        await ScrollTrackerNative?.stopTrackingService?.();
      } catch (e) {
        console.warn("[v0] Failed to stop tracking service:", e?.message);
      }
      console.log("[v0] TrackingService stopped");
    } catch (error) {
      console.error("[v0] Error stopping TrackingService:", error?.message);
    }
  }

  /** @param {import("../types").NativeScrollEvent} event */
  async #handleEvent(rawEvent) {
    // Safety check: ensure rawEvent exists
    if (!rawEvent || typeof rawEvent !== 'object') {
      console.warn("[v0] Invalid event received:", typeof rawEvent);
      return;
    }

    // Normalize alternate package IDs (e.g. TikTok's com.ss.android.ugc.trill)
    // to the canonical one stored in the platforms table.
    const event = { ...rawEvent, packageName: canonicalPackageName(rawEvent.packageName) };

    // Safety check: ensure service is still active (not stopped during shutdown)
    if (this.#unsubscribe === null && event.eventType !== "app_background") {
      return;
    }

    const platform = this.#platformsByPackage.get(event.packageName);
    if (!platform) return; // not a tracked app

    try {
      if (
        (event.eventType === "app_foreground" || event.eventType === "window_state_changed") &&
        !this.#openSessionIds.has(event.packageName)
      ) {
        const sessionId = await trackingRepository?.openSession?.(platform.id, event.timestamp, "accessibility");
        if (sessionId) {
          this.#openSessionIds.set(event.packageName, sessionId);

          const focusState = useFocusStore?.getState?.();
          if (focusState?.isActive) {
            notifyFocusModeBreach(platform.displayName).catch(() => {});
          }
        }
      }

      const result = this.#estimator?.ingest?.(event);
      if (!result) return;

      if (result.newEvent) {
        const sessionId = this.#openSessionIds.get(event.packageName);
        if (sessionId) {
          await trackingRepository?.appendVideoEvent?.(
            sessionId,
            result.newEvent.occurredAt,
            result.newEvent.confidence,
            result.newEvent.detection,
            {
              swipeDirection: result.newEvent.direction || null,
              appScreenState: result.newEvent.appScreen || null,
              detectionSource: result.newEvent.detection === 'swipe_direct' ? 'swipe' : 'heuristic'
            }
          );
          useTrackingStore?.getState?.()?.incrementLiveCount?.(platform.key);
        }
      }
    } catch (error) {
      console.warn("[v0] Error handling event:", error?.message);
    }
  }

  async #sweep() {
    try {
      if (this.#unsubscribe === null) {
        return; // Service is stopped
      }

      const now = Date.now();
      const closed = this.#estimator?.sweepTimeouts?.(now) || [];
      
      for (const c of closed) {
        if (!c || !c.packageName) continue;
        
        const sessionId = this.#openSessionIds.get(c.packageName);
        if (sessionId) {
          try {
            await trackingRepository?.closeSession?.(sessionId, c.endedAt);
            this.#openSessionIds.delete(c.packageName);
            useTrackingStore?.getState?.()?.refreshToday?.();
          } catch (error) {
            console.warn("[v0] Error closing session:", error?.message);
          }
        }
      }
    } catch (error) {
      console.warn("[v0] Sweep error:", error?.message);
    }
  }
}

export const TrackingService = new TrackingServiceImpl();
