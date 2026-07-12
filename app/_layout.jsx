import "../src/global.css";
import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
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
      await getDatabase(); // runs migrations
      await Promise.all([initTracking(), refreshPermissions(), loadSettings()]);

      const perms = usePermissionsStore.getState();
      if (allRequiredPermissionsGranted(perms) && perms.onboardingComplete) {
        await TrackingService.start();
        useTrackingStore.getState().setTrackingActive(true);
      }

      setReady(true);
      await SplashScreen.hideAsync();

      if (!perms.onboardingComplete) {
        router.replace("/onboarding");
      }
    })();

    return () => {
      TrackingService.stop();
    };
  }, []);

  if (!ready) return <View className="flex-1 bg-bg" />;

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
