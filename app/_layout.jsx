import "../src/global.css";
import { useEffect, useState } from "react";
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
  const initTracking = useTrackingStore((s) => s.init);
  const refreshPermissions = usePermissionsStore((s) => s.refresh);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    (async () => {
      try {
        // Try to initialize database
        try {
          await getDatabase();
          console.log("[v0] Database initialized");
        } catch (dbError) {
          console.warn("[v0] Database init failed:", dbError);
        }

        // Try to load stores
        try {
          await Promise.all([initTracking(), refreshPermissions(), loadSettings()]);
          console.log("[v0] Stores initialized");
        } catch (storeError) {
          console.warn("[v0] Store init failed:", storeError);
        }

        // Try to start tracking
        try {
          const perms = usePermissionsStore.getState();
          if (allRequiredPermissionsGranted(perms) && perms.onboardingComplete) {
            await TrackingService.start();
            useTrackingStore.getState().setTrackingActive(true);
            console.log("[v0] Tracking started");
          }
        } catch (trackingError) {
          console.warn("[v0] Tracking init failed:", trackingError);
        }

        setReady(true);
        await SplashScreen.hideAsync();

        // Check onboarding
        try {
          const perms = usePermissionsStore.getState();
          if (!perms.onboardingComplete) {
            router.replace("/onboarding");
          }
        } catch (e) {
          console.warn("[v0] Could not check onboarding:", e);
        }
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
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}
