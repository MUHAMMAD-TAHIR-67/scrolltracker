import { create } from "zustand";
import * as Notifications from "expo-notifications";
import { ScrollTrackerNative } from "../native/ScrollTrackerModule";
import { getDatabase } from "@/db/database";

/**
 * @typedef {Object} PermissionsState
 * @property {boolean} accessibilityGranted
 * @property {boolean} usageAccessGranted
 * @property {boolean} notificationsGranted
 * @property {boolean} onboardingComplete
 * @property {() => Promise<void>} refresh
 * @property {() => Promise<void>} requestNotifications
 * @property {() => void} openAccessibilitySettings
 * @property {() => void} openUsageAccessSettings
 * @property {() => void} completeOnboarding
 */

const ONBOARDING_KEY = "onboarding_complete";

async function readOnboardingComplete() {
  const db = await getDatabase();
  const row = await db.getFirstAsync("SELECT value FROM settings WHERE key = ?;", [ONBOARDING_KEY]);
  return row?.value === "1";
}

async function writeOnboardingComplete() {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = '1';`,
    [ONBOARDING_KEY]
  );
}

export const usePermissionsStore = create((set, get) => ({
  accessibilityGranted: false,
  usageAccessGranted: false,
  notificationsGranted: false,
  onboardingComplete: false,

  refresh: async () => {
    const [accessibility, usage, notif, onboardingComplete] = await Promise.all([
      ScrollTrackerNative.isAccessibilityServiceEnabled(),
      ScrollTrackerNative.isUsageAccessGranted(),
      Notifications.getPermissionsAsync().then((r) => r.granted),
      readOnboardingComplete(),
    ]);
    set({
      accessibilityGranted: accessibility,
      usageAccessGranted: usage,
      notificationsGranted: notif,
      onboardingComplete,
    });
  },

  requestNotifications: async () => {
    const result = await Notifications.requestPermissionsAsync();
    set({ notificationsGranted: result.granted });
  },

  openAccessibilitySettings: () => ScrollTrackerNative.openAccessibilitySettings(),
  openUsageAccessSettings: () => ScrollTrackerNative.openUsageAccessSettings(),

  completeOnboarding: () => {
    set({ onboardingComplete: true });
    writeOnboardingComplete().catch(() => {});
  },
}));

/**
 * All permissions required before tracking is meaningfully accurate.
 * @param {PermissionsState} state
 * @returns {boolean}
 */
export function allRequiredPermissionsGranted(state) {
  return state.accessibilityGranted && state.usageAccessGranted;
}
