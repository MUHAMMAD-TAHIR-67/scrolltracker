import "../src/global.css";
import { useEffect, useState, useRef } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import { getDatabase } from "@/db/database";
import { useTrackingStore } from "@/features/tracking/store/trackingStore";
import { usePermissionsStore, allRequiredPermissionsGranted } from "@/features/tracking/store/permissionsStore";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { TrackingService } from "@/features/tracking/services/TrackingService";

SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let initializationDone = false;

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Use a module-level flag instead of useRef to truly prevent re-running
    if (initializationDone) {
      setReady(true);
      return;
    }
    initializationDone = true;

    (async () => {
      try {
        // Initialize database
        try {
          await getDatabase();
        } catch (dbError) {
          console.warn("[v0] Database init failed:", dbError);
        }

        // Load stores
        try {
          await Promise.all([
            useTrackingStore.getState().init(),
            usePermissionsStore.getState().refresh(),
            useSettingsStore.getState().load(),
          ]);
        } catch (storeError) {
          console.warn("[v0] Store init failed:", storeError);
        }

        // If onboarding was already completed in a previous session, restart
        // tracking now - onboarding/index.jsx only calls TrackingService.start()
        // the very first time, so every later app launch needs to do it here.
        try {
          const perms = usePermissionsStore.getState();
          if (!perms.onboardingComplete) {
            // User hasn't completed onboarding yet - don't start tracking
            useTrackingStore.getState().setTrackingActive(false);
          } else if (allRequiredPermissionsGranted(perms)) {
            await TrackingService.start();
            useTrackingStore.getState().setTrackingActive(true);
          } else {
            // Onboarding finished before but a required permission is now
            // missing (e.g. user revoked Accessibility) - don't start.
            useTrackingStore.getState().setTrackingActive(false);
          }
        } catch (error) {
          console.warn("[v0] Could not check onboarding status:", error);
        }

        setReady(true);
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error("[v0] Fatal error:", error);
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();

    return () => {
      try {
        TrackingService.stop();
      } catch (e) {
        console.warn("[v0] Error stopping tracking:", e);
      }
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 bg-bg justify-center items-center">
        <Text className="text-white text-lg">Loading ScrollTracker...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen 
          name="(tabs)" 
          options={{ animationEnabled: false }}
        />
        <Stack.Screen 
          name="onboarding/index" 
          options={{ animationEnabled: false }}
        />
      </Stack>
    </View>
  );
}