import { create } from "zustand";
import * as Notifications from "expo-notifications";
import { getDatabase } from "@/db/database";

/**
 * @typedef {Object} FocusState
 * @property {boolean} isActive
 * @property {number|null} startedAt
 * @property {number} plannedMs
 * @property {number} remainingMs
 * @property {(plannedMs: number) => Promise<void>} start
 * @property {() => void} tick
 * @property {(interrupted: boolean) => Promise<void>} end
 */

let intervalHandle = null;

export const useFocusStore = create((set, get) => ({
  isActive: false,
  startedAt: null,
  plannedMs: 0,
  remainingMs: 0,

  start: async (plannedMs) => {
    const db = await getDatabase();
    const startedAt = Date.now();
    await db.runAsync(
      `INSERT INTO focus_sessions (started_at, planned_ms, interrupted) VALUES (?, ?, 0);`,
      [startedAt, plannedMs]
    );
    set({ isActive: true, startedAt, plannedMs, remainingMs: plannedMs });

    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = setInterval(() => get().tick(), 1000);
  },

  tick: () => {
    const { startedAt, plannedMs } = get();
    if (!startedAt) return;
    const remaining = Math.max(0, plannedMs - (Date.now() - startedAt));
    set({ remainingMs: remaining });
    if (remaining === 0) get().end(false);
  },

  end: async (interrupted) => {
    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = null;
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE focus_sessions SET ended_at = ?, interrupted = ? WHERE ended_at IS NULL;`,
      [Date.now(), interrupted ? 1 : 0]
    );
    if (!interrupted) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Focus session complete 🎉",
          body: "Nice work staying off short-form video. Keep the streak going.",
        },
        trigger: null,
      });
    }
    set({ isActive: false, startedAt: null, remainingMs: 0 });
  },
}));

/**
 * Called from TrackingService whenever a session opens on a tracked package
 * while Focus Mode is active - fires a "you exceeded your limit" style alert
 * immediately rather than waiting for the next dashboard visit.
 * @param {string} platformDisplayName
 */
export async function notifyFocusModeBreach(platformDisplayName) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Focus Mode is on",
      body: `You opened ${platformDisplayName} during a Focus session. Consider closing it.`,
      data: { type: "focus_breach" },
    },
    trigger: null,
  });
}
