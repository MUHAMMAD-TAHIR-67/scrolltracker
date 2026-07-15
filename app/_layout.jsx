import "../src/global.css";
import { useEffect, useState, useRef } from "react";
import { Stack, router } from "expo-router";
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

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    // Prevent initialization from running multiple times
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        console.log("[v0] Starting app initialization");

        // Initialize database
        try {
          console.log("[v0] Initializing database...");
          await getDatabase();
          console.log("[v0] Database ready");
        } catch (dbError) {
          console.warn("[v0] Database init failed:", dbError);
        }

        // Load stores
        try {
          console.log("[v0] Initializing stores...");
          await Promise.all([
            useTrackingStore.getState().init(),
            usePermissionsStore.getState().refresh(),
            useSettingsStore.getState().load(),
          ]);
          console.log("[v0] Stores ready");
        } catch (storeError) {
          console.warn("[v0] Store init failed:", storeError);
        }

        // Start tracking if allowed
        try {
          console.log("[v0] Checking permissions...");
          const perms = usePermissionsStore.getState();
          console.log("[v0] Permissions state:", {
            onboardingComplete: perms.onboardingComplete,
            allGranted: allRequiredPermissionsGranted(perms),
          });
          if (allRequiredPermissionsGranted(perms) && perms.onboardingComplete) {
            console.log("[v0] Starting tracking service...");
            await TrackingService.start();
            useTrackingStore.getState().setTrackingActive(true);
            console.log("[v0] Tracking active");
          }
        } catch (trackingError) {
          console.warn("[v0] Tracking init failed:", trackingError);
        }

        console.log("[v0] Marking app as ready");
        setReady(true);

        // Hide splash screen
        try {
          await SplashScreen.hideAsync();
          console.log("[v0] Splash screen hidden");
        } catch (e) {
          console.warn("[v0] Error hiding splash screen:", e);
        }

        // Navigate to onboarding if needed (do this after setReady)
        try {
          const perms = usePermissionsStore.getState();
          if (!perms.onboardingComplete) {
            console.log("[v0] Navigating to onboarding");
            router.replace("/onboarding");
          }
        } catch (navError) {
          console.warn("[v0] Navigation error:", navError);
        }
      } catch (error) {
        console.error("[v0] Fatal error:", error);
        setReady(true);
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.warn("[v0] Error hiding splash in catch:", e);
        }
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
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}
