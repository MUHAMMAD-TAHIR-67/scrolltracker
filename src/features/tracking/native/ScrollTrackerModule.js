import { NativeEventEmitter, NativeModules, Platform } from "react-native";

/**
 * Thin typed wrapper around the native `ScrollTrackerModule` (Kotlin).
 *
 * On non-Android (web preview, Expo Go, etc.) every method returns a
 * no-op so the JS bundle completes without throwing.
 */

const noop = () => {};
const noopAsync = () => Promise.resolve(false);

/** Fallback used when the native module is not linked (dev preview, web, etc.) */
const STUB = {
  openAccessibilitySettings: noop,
  openUsageAccessSettings: noop,
  openOverlaySettings: noop,
  isOverlayPermissionGranted: noopAsync,
  isAccessibilityServiceEnabled: noopAsync,
  isUsageAccessGranted: noopAsync,
  requestIgnoreBatteryOptimizations: noopAsync,
  isIgnoringBatteryOptimizations: noopAsync,
  openAutostartSettings: noop,
  startTrackingService: noopAsync,
  stopTrackingService: noopAsync,
  queryUsageStats: () => Promise.resolve([]),
  drainPendingEvents: () => Promise.resolve([]),
  syncNativePrefs: noopAsync,
  acknowledgeEvents: noopAsync,
};

export const ScrollTrackerNative =
  Platform.OS === "android" && NativeModules.ScrollTrackerModule
    ? NativeModules.ScrollTrackerModule
    : STUB;

export const scrollTrackerEmitter =
  Platform.OS === "android" && NativeModules.ScrollTrackerModule
    ? (() => {
        try {
          return new NativeEventEmitter(NativeModules.ScrollTrackerModule);
        } catch (_) {
          return null;
        }
      })()
    : null;

export function subscribeToScrollEvents(listener) {
  if (!scrollTrackerEmitter) {
    return () => {}; // noop unsubscribe — native not linked
  }
  const sub = scrollTrackerEmitter.addListener("onScrollEvent", listener);
  return () => sub?.remove();
}
