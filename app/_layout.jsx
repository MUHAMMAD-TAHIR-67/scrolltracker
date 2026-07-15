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
  const onboardingComplete = usePermissionsStore((s) => s.onboardingComplete);

  useEffect(() => {
    (async () => {
      try {
        console.log("[v0] Starting app initialization");
        await getDatabase(); // runs migrations
        console.log("[v0] Database initialized");
        
        await Promise.all([initTracking(), refreshPermissions(), loadSettings()]);
        console.log("[v0] Stores initialized");

        const perms = usePermissionsStore.getState();
        if (allRequiredPermissionsGranted(perms) && perms.onboardingComplete) {
          await TrackingService.start();
          useTrackingStore.getState().setTrackingActive(true);
        }

        setReady(true);
        await SplashScreen.hideAsync();
        console.log("[v0] App ready");

        if (!perms.onboardingComplete) {
          router.replace("/onboarding");
        }
      } catch (error) {
        console.error("[v0] Initialization error:", error);
        // Set ready anyway to show error screen
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();

    return () => {
      TrackingService.stop();
    };
  }, []);

  if (!ready) return (
    <View className="flex-1 bg-bg justify-center items-center">
      <Text className="text-white text-lg">Loading ScrollTracker...</Text>
    </View>
  );

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
