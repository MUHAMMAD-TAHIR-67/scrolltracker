import { create } from "zustand";
import * as Notifications from "expo-notifications";
import { ScrollTrackerNative } from "../native/ScrollTrackerModule";
import { getDatabase } from "@/db/database";

/**
 * @typedef {Object} PermissionsState
 * @property {boolean} accessibilityGranted
 * @property {boolean} usageAccessGranted
 * @property {boolean} notificationsGranted
 * @property {boolean} batteryOptimizationIgnored
 * @property {boolean} onboardingComplete
 * @property {() => Promise<void>} refresh
 * @property {() => Promise<void>} requestNotifications
 * @property {() => void} openAccessibilitySettings
 * @property {() => void} openUsageAccessSettings
 * @property {() => void} requestBatteryOptimizationExemption
 * @property {() => void} openAutostartSettings
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
  batteryOptimizationIgnored: false,
  onboardingComplete: false,

  refresh: async () => {
    try {
      const [accessibility, usage, notif, batteryIgnored, onboardingComplete] = await Promise.all([
        ScrollTrackerNative.isAccessibilityServiceEnabled?.() ?? Promise.resolve(false),
        ScrollTrackerNative.isUsageAccessGranted?.() ?? Promise.resolve(false),
        Notifications.getPermissionsAsync().then((r) => r.granted),
        ScrollTrackerNative.isIgnoringBatteryOptimizations?.() ?? Promise.resolve(false),
        readOnboardingComplete(),
      ]);
      set({
        accessibilityGranted: accessibility,
        usageAccessGranted: usage,
        notificationsGranted: notif,
        batteryOptimizationIgnored: batteryIgnored,
        onboardingComplete,
      });
    } catch (e) {
      console.warn("Failed to refresh permissions:", e);
    }
  },

  requestNotifications: async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();
      set({ notificationsGranted: result.granted });
    } catch (e) {
      console.warn("Failed to request notifications:", e);
    }
  },

  openAccessibilitySettings: () => {
    try {
      ScrollTrackerNative.openAccessibilitySettings?.();
    } catch (e) {
      console.warn("Failed to open accessibility settings:", e);
    }
  },
  openUsageAccessSettings: () => {
    try {
      ScrollTrackerNative.openUsageAccessSettings?.();
    } catch (e) {
      console.warn("Failed to open usage access settings:", e);
    }
  },

  requestBatteryOptimizationExemption: async () => {
    try {
      await ScrollTrackerNative.requestIgnoreBatteryOptimizations?.();
    } catch (e) {
      console.warn("Failed to request battery optimization exemption:", e?.message);
    }
  },

  openAutostartSettings: () => {
    try {
      ScrollTrackerNative.openAutostartSettings?.();
    } catch (e) {
      console.warn("Failed to open autostart settings:", e);
    }
  },

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