import { ScrollTrackerNative, subscribeToScrollEvents } from "../native/ScrollTrackerModule";
import { trackingRepository } from "../repository/TrackingRepository";
import { useTrackingStore } from "../store/trackingStore";
import { useFocusStore, notifyFocusModeBreach } from "@/features/focus/services/FocusModeService";

const PACKAGE_ALIASES = { "com.ss.android.ugc.trill": "com.zhiliaoapp.musically" };
const SESSION_IDLE_MS = 5 * 60 * 1000;
const canonicalPackageName = (name) => PACKAGE_ALIASES[name] ?? name;

class TrackingServiceImpl {
  #unsubscribe = null;
  #sweepInterval = null;
  #platformsByPackage = new Map();
  #openSessionIds = new Map();
  #lastActivity = new Map();
  #queue = Promise.resolve();

  async start() {
    if (this.#unsubscribe !== null) return;
    const platforms = await trackingRepository.getPlatforms();
    platforms.forEach((platform) => this.#platformsByPackage.set(platform.packageName, platform));
    this.#platformsByPackage.set(
      "com.zhiliaoapp.musically",
      platforms.find((platform) => platform.key === "tiktok")
    );

    // Subscribe first so events arriving during replay are queued behind the backlog.
    this.#unsubscribe = subscribeToScrollEvents((event) => this.#enqueue(event));
    await ScrollTrackerNative.startTrackingService?.().catch(() => {});
    const pending = await ScrollTrackerNative.drainPendingEvents?.().catch(() => []);
    for (const event of Array.isArray(pending) ? pending : []) await this.#enqueue(event);

    this.#sweepInterval = setInterval(() => this.#enqueueSweep(), 30_000);
  }

  async stop() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#sweepInterval) clearInterval(this.#sweepInterval);
    this.#sweepInterval = null;
    await this.#queue.catch(() => {});
    await ScrollTrackerNative.stopTrackingService?.().catch(() => {});
  }

  #enqueue(event) {
    const work = () => this.#handleEvent(event);
    this.#queue = this.#queue.then(work, work);
    return this.#queue;
  }

  #enqueueSweep() {
    const work = () => this.#closeIdleSessions();
    this.#queue = this.#queue.then(work, work);
  }

  async #ensureSession(packageName, timestamp) {
    const current = this.#openSessionIds.get(packageName);
    if (current) return current;
    const platform = this.#platformsByPackage.get(packageName);
    if (!platform) return -1;
    const sessionId = await trackingRepository.openSession(platform.id, timestamp, "accessibility");
    if (sessionId > 0) {
      this.#openSessionIds.set(packageName, sessionId);
      const focusState = useFocusStore?.getState?.();
      if (focusState?.isActive) notifyFocusModeBreach(platform.displayName).catch(() => {});
    }
    return sessionId;
  }

  async #handleEvent(rawEvent) {
    if (!rawEvent?.packageName || this.#unsubscribe === null) return;
    const packageName = canonicalPackageName(rawEvent.packageName);
    const platform = this.#platformsByPackage.get(packageName);
    if (!platform) return;
    const timestamp = Number(rawEvent.timestamp) || Date.now();
    this.#lastActivity.set(packageName, timestamp);

    if (rawEvent.eventType === "app_foreground") {
      await this.#ensureSession(packageName, timestamp);
      return;
    }
    if (rawEvent.eventType !== "video_swipe" || !rawEvent.id) return;

    const sessionId = await this.#ensureSession(packageName, timestamp);
    if (sessionId <= 0) return;
    const result = await trackingRepository.appendVideoEvent(sessionId, rawEvent.id, timestamp, {
      swipeDirection: rawEvent.direction ?? null,
      appScreenState: rawEvent.appScreen ?? "short_video_feed",
    });
    if (!result.committed) return;

    await ScrollTrackerNative.acknowledgeEvents?.([rawEvent.id]).catch(() => {});
    if (result.inserted) await useTrackingStore.getState().refreshToday();
  }

  async #closeIdleSessions() {
    const now = Date.now();
    for (const [packageName, lastAt] of this.#lastActivity) {
      if (now - lastAt < SESSION_IDLE_MS) continue;
      const sessionId = this.#openSessionIds.get(packageName);
      if (sessionId) await trackingRepository.closeSession(sessionId, lastAt);
      this.#openSessionIds.delete(packageName);
      this.#lastActivity.delete(packageName);
    }
  }
}

export const TrackingService = new TrackingServiceImpl();
