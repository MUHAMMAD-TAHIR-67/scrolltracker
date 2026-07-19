import "../src/global.css";
import { useEffect, useState } from "react";
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
          // non-fatal — app can still render
        }

        // Load all stores in parallel
        try {
          await Promise.all([
            useTrackingStore.getState().init(),
            usePermissionsStore.getState().refresh(),
            useSettingsStore.getState().load(),
          ]);
        } catch (storeError) {
          // non-fatal
        }

        // Start tracking service on every launch (not just first time)
        try {
          const perms = usePermissionsStore.getState();
          if (!perms.onboardingComplete) {
            useTrackingStore.getState().setTrackingActive(false);
          } else if (allRequiredPermissionsGranted(perms)) {
            await TrackingService.start();
            useTrackingStore.getState().setTrackingActive(true);
          } else {
            useTrackingStore.getState().setTrackingActive(false);
          }
        } catch (trackingError) {
          useTrackingStore.getState().setTrackingActive(false);
        }
      } catch (_) {
        // fallthrough — always show UI
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    })();

    return () => {
      try {
        TrackingService.stop();
      } catch (_) {}
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-text text-lg">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ animationEnabled: false }} />
        <Stack.Screen name="onboarding/index" options={{ animationEnabled: false }} />
      </Stack>
    </View>
  );
}
