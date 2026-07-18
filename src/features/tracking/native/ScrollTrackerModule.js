import { NativeEventEmitter, NativeModules, Platform } from "react-native";

/**
 * Thin typed wrapper around the native `ScrollTrackerModule` (Kotlin) that is
 * registered in android/app/src/main/java/com/scrolltracker/.
 *
 * All heavy lifting (listening to AccessibilityEvents, debouncing, talking to
 * UsageStatsManager) happens on the native side inside a foreground Service;
 * this bridge only exposes control methods + a stream of already-lightweight
 * events, so the JS thread is never on the hot path of accessibility events.
 *
 * @typedef {Object} ScrollTrackerNativeModule
 * @property {() => void} openAccessibilitySettings Opens Android's Accessibility Settings screen so the user can enable the service.
 * @property {() => void} openUsageAccessSettings Opens the "Usage Access" settings screen (Settings > Apps > Special access > Usage access).
 * @property {() => Promise<boolean>} isAccessibilityServiceEnabled True if our AccessibilityService is currently enabled by the user.
 * @property {() => Promise<boolean>} isUsageAccessGranted True if PACKAGE_USAGE_STATS access has been granted.
 * @property {() => Promise<boolean>} requestIgnoreBatteryOptimizations Prompts the standard Android "ignore battery optimizations" dialog for this app. Resolves true if already granted, false if the dialog was just launched (caller should refresh() afterwards), rejects if even the fallback screen couldn't be opened.
 * @property {() => Promise<boolean>} isIgnoringBatteryOptimizations True if battery-optimization exemption is already granted.
 * @property {() => void} openAutostartSettings Opens the OEM-specific autostart/background-app screen (Xiaomi/Vivo/Oppo/Huawei) if this device has one, otherwise falls back to the app's details screen. Needed because standard battery-optimization exemption alone is not enough on these brands - they have a second, separate "allow autostart" toggle that also has to be granted or the OS will still kill the accessibility service in the background.
 * @property {() => Promise<void>} startTrackingService Starts the foreground tracking service (safe to call repeatedly).
 * @property {() => Promise<void>} stopTrackingService Stops the foreground tracking service (e.g. user disables tracking).
 * @property {(startMillis: number, endMillis: number) => Promise<Array<{packageName: string, totalTimeInForegroundMs: number}>>} queryUsageStats Pulls aggregated per-app foreground time from UsageStatsManager for a time range.
 * @property {() => Promise<import("../types").NativeScrollEvent[]>} drainPendingEvents Reads and clears the native-side ring buffer of pending events.
 * @property {(thresholdMinutes: number, excessiveScrollNotificationsEnabled: boolean) => Promise<void>} syncNativePrefs Mirrors excessive-scrolling threshold/toggle into native SharedPreferences.
 */

const LINKING_ERROR =
  "ScrollTrackerModule native module is not linked. Did you run `expo prebuild` " +
  "and rebuild the dev client after adding the native module?";

/** @type {ScrollTrackerNativeModule} */
export const ScrollTrackerNative =
  Platform.OS === "android" && NativeModules.ScrollTrackerModule
    ? NativeModules.ScrollTrackerModule
    : new Proxy(
        {},
        {
          get() {
            throw new Error(LINKING_ERROR);
          },
        }
      );

/** Emits `onScrollEvent` (NativeScrollEvent) in near-real-time while the service runs. */
export const scrollTrackerEmitter =
  Platform.OS === "android" && NativeModules.ScrollTrackerModule
    ? (() => {
        try {
          return new NativeEventEmitter(NativeModules.ScrollTrackerModule);
        } catch (e) {
          console.warn("Failed to create NativeEventEmitter:", e);
          return null;
        }
      })()
    : null;

/** @param {(event: import("../types").NativeScrollEvent) => void} listener */
export function subscribeToScrollEvents(listener) {
  if (!scrollTrackerEmitter) {
    console.warn("ScrollTrackerEmitter is not available - native module not linked");
    return () => {}; // noop unsubscribe
  }
  const sub = scrollTrackerEmitter.addListener("onScrollEvent", listener);
  return () => sub?.remove();
}