import { create } from "zustand";
import { getDatabase } from "@/db/database";
import { ScrollTrackerNative } from "@/features/tracking/native/ScrollTrackerModule";
import { Platform } from "react-native";

function syncNative(thresholdMinutes, excessiveEnabled) {
  if (Platform.OS === "android" && ScrollTrackerNative.syncNativePrefs) {
    ScrollTrackerNative.syncNativePrefs(thresholdMinutes, excessiveEnabled).catch((e) => {
      console.warn("Failed to sync native prefs:", e);
    });
  }
}

/**
 * @typedef {Object} SettingsState
 * @property {number} excessiveScrollThresholdMin continuous minutes on a tracked app before "excessive scrolling" alert
 * @property {boolean} dailyLimitNotificationsEnabled
 * @property {boolean} excessiveScrollNotificationsEnabled
 * @property {"dark"|"light"|"system"} themeMode
 * @property {boolean} hasLoaded
 * @property {() => Promise<void>} load
 * @property {(minutes: number) => Promise<void>} setExcessiveScrollThreshold
 * @property {(enabled: boolean) => Promise<void>} toggleDailyLimitNotifications
 * @property {(enabled: boolean) => Promise<void>} toggleExcessiveScrollNotifications
 * @property {(mode: "dark"|"light"|"system") => Promise<void>} setThemeMode
 */

const DEFAULTS = {
  excessiveScrollThresholdMin: 20,
  dailyLimitNotificationsEnabled: true,
  excessiveScrollNotificationsEnabled: true,
  themeMode: "dark",
};

async function getSetting(key) {
  const db = await getDatabase();
  const row = await db.getFirstAsync("SELECT value FROM settings WHERE key = ?;", [key]);
  return row?.value ?? null;
}

async function setSetting(key, value) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value]
  );
}

export const useSettingsStore = create((set, get) => ({
  ...DEFAULTS,
  hasLoaded: false,

  load: async () => {
    const [threshold, dailyNotif, excessiveNotif, theme] = await Promise.all([
      getSetting("excessive_scroll_threshold_min"),
      getSetting("daily_limit_notifications_enabled"),
      getSetting("excessive_scroll_notifications_enabled"),
      getSetting("theme_mode"),
    ]);
    set({
      excessiveScrollThresholdMin: threshold ? Number(threshold) : DEFAULTS.excessiveScrollThresholdMin,
      dailyLimitNotificationsEnabled: dailyNotif ? dailyNotif === "1" : DEFAULTS.dailyLimitNotificationsEnabled,
      excessiveScrollNotificationsEnabled:
        excessiveNotif ? excessiveNotif === "1" : DEFAULTS.excessiveScrollNotificationsEnabled,
      themeMode: theme ?? DEFAULTS.themeMode,
      hasLoaded: true,
    });
    const s = get();
    syncNative(s.excessiveScrollThresholdMin, s.excessiveScrollNotificationsEnabled);
  },

  setExcessiveScrollThreshold: async (minutes) => {
    await setSetting("excessive_scroll_threshold_min", String(minutes));
    set({ excessiveScrollThresholdMin: minutes });
    syncNative(minutes, get().excessiveScrollNotificationsEnabled);
  },

  toggleDailyLimitNotifications: async (enabled) => {
    await setSetting("daily_limit_notifications_enabled", enabled ? "1" : "0");
    set({ dailyLimitNotificationsEnabled: enabled });
  },

  toggleExcessiveScrollNotifications: async (enabled) => {
    await setSetting("excessive_scroll_notifications_enabled", enabled ? "1" : "0");
    set({ excessiveScrollNotificationsEnabled: enabled });
    syncNative(get().excessiveScrollThresholdMin, enabled);
  },

  setThemeMode: async (mode) => {
    await setSetting("theme_mode", mode);
    set({ themeMode: mode });
  },
}));
