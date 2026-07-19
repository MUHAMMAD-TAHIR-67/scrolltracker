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
        // Initialize database (critical - must not fail)
        try {
          const db = await getDatabase();
          if (!db) {
            console.error("[v0] Failed to initialize database - critical error");
          }
        } catch (dbError) {
          console.error("[v0] Database init failed:", dbError?.message);
        }

        // Load stores in parallel
        try {
          await Promise.all([
            useTrackingStore.getState().init(),
            usePermissionsStore.getState().refresh(),
            useSettingsStore.getState().load(),
          ]);
          console.log("[v0] All stores initialized successfully");
        } catch (storeError) {
          console.error("[v0] Store init failed:", storeError?.message);
        }

        // Start tracking service if conditions are met
        // This runs on EVERY app launch (not just first time)
        // so the service can restart if the OS killed it
        try {
          const perms = usePermissionsStore.getState();
          
          if (!perms.onboardingComplete) {
            console.log("[v0] Onboarding not completed, skipping tracking");
            useTrackingStore.getState().setTrackingActive(false);
          } else if (allRequiredPermissionsGranted(perms)) {
            console.log("[v0] Starting tracking service...");
            await TrackingService.start();
            useTrackingStore.getState().setTrackingActive(true);
            console.log("[v0] Tracking service started successfully");
          } else {
            console.log("[v0] Required permissions missing, cannot start tracking");
            useTrackingStore.getState().setTrackingActive(false);
          }
        } catch (error) {
          console.error("[v0] Error starting tracking:", error?.message);
          useTrackingStore.getState().setTrackingActive(false);
        }

        setReady(true);
        await SplashScreen.hideAsync();
        console.log("[v0] App initialization complete");
      } catch (error) {
        console.error("[v0] Fatal initialization error:", error?.message);
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();

    // Cleanup function to stop tracking when app closes
    return () => {
      try {
        console.log("[v0] App closing, stopping tracking service");
        TrackingService.stop();
      } catch (e) {
        console.warn("[v0] Error stopping tracking:", e?.message);
      }
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-text text-lg">Loading ScrollTracker...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
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
