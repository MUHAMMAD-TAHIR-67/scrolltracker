import { create } from "zustand";
import { trackingRepository } from "@/features/tracking/repository/TrackingRepository";

/**
 * @typedef {Object} GoalsState
 * @property {import("@/features/tracking/types").Goal[]} goals
 * @property {number} streak
 * @property {boolean} isLoading
 * @property {() => Promise<void>} load
 * @property {(platformId: number|null, goalType: import("@/features/tracking/types").GoalType, limitValue: number) => Promise<void>} setGoal
 */

export const useGoalsStore = create((set, get) => ({
  goals: [],
  streak: 0,
  isLoading: true,

  load: async () => {
    const [goals, streak] = await Promise.all([
      trackingRepository.getActiveGoals(),
      trackingRepository.getCurrentStreak(),
    ]);
    set({ goals, streak, isLoading: false });
  },

  setGoal: async (platformId, goalType, limitValue) => {
    await trackingRepository.upsertGoal({
      platformId,
      goalType,
      limitValue,
      isActive: true,
    });
    await get().load();
  },
}));

/**
 * Checks a single platform's today stat against any active goal for it. Returns 0-1+ (can exceed 1 when over limit).
 * @param {import("@/features/tracking/types").Goal|undefined} goal
 * @param {number} totalVideos
 * @param {number} totalDurationMs
 * @returns {number}
 */
export function goalProgress(goal, totalVideos, totalDurationMs) {
  if (!goal) return 0;
  const value = goal.goalType === "video_count" ? totalVideos : totalDurationMs;
  return value / goal.limitValue;
}
