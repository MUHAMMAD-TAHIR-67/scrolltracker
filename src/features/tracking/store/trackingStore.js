import { create } from "zustand";
import { format } from "date-fns";
import { trackingRepository } from "../repository/TrackingRepository";

/**
 * @typedef {Object} TrackingState
 * @property {import("../types").Platform[]} platforms
 * @property {Record<import("../types").PlatformKey, import("../types").DailyStat|null>} todayStats
 * @property {Record<import("../types").PlatformKey, number>} liveCounts optimistic in-memory bump before DB rollup catches up
 * @property {boolean} isTrackingActive
 * @property {boolean} isLoading
 * @property {() => Promise<void>} init
 * @property {() => Promise<void>} refreshToday
 * @property {(key: import("../types").PlatformKey) => void} incrementLiveCount
 * @property {(active: boolean) => void} setTrackingActive
 */

const emptyCounts = () => ({
  instagram_reels: 0,
  youtube_shorts: 0,
  tiktok: 0,
  snapchat_spotlight: 0,
});

const emptyStats = () => ({
  instagram_reels: null,
  youtube_shorts: null,
  tiktok: null,
  snapchat_spotlight: null,
});

/** @type {import("zustand").UseBoundStore<import("zustand").StoreApi<TrackingState>>} */
export const useTrackingStore = create((set, get) => ({
  platforms: [],
  todayStats: emptyStats(),
  liveCounts: emptyCounts(),
  isTrackingActive: false,
  isLoading: true,

  init: async () => {
    const platforms = await trackingRepository.getPlatforms();
    set({ platforms, isLoading: false });
    await get().refreshToday();
  },

  refreshToday: async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const stats = await trackingRepository.getDailyStats(today);
    const byKey = emptyStats();
    const { platforms } = get();
    for (const stat of stats) {
      const platform = platforms.find((p) => p.id === stat.platformId);
      if (platform) byKey[platform.key] = stat;
    }
    set({ todayStats: byKey, liveCounts: emptyCounts() });
  },

  incrementLiveCount: (key) => {
    set((state) => ({
      liveCounts: { ...state.liveCounts, [key]: state.liveCounts[key] + 1 },
    }));
  },

  setTrackingActive: (active) => set({ isTrackingActive: active }),
}));

/**
 * Derived helper: live rollup = persisted total (as of last close) + optimistic live bump.
 * @param {TrackingState} state
 * @param {import("../types").PlatformKey} key
 * @returns {number}
 */
export function selectDisplayCount(state, key) {
  const persisted = state.todayStats[key]?.totalVideos ?? 0;
  return persisted + state.liveCounts[key];
}
