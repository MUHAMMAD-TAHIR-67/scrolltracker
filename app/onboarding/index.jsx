import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  usePermissionsStore,
  allRequiredPermissionsGranted,
} from "@/features/tracking/store/permissionsStore";
import { TrackingService } from "@/features/tracking/services/TrackingService";
import { useTrackingStore } from "@/features/tracking/store/trackingStore";

const STEPS = [
  {
    title: "Understand your scrolling",
    body:
      "ScrollTracker counts how many Reels, Shorts, TikToks, and Spotlight videos you watch, and how long you spend on each — so you can see the pattern, not just feel it.",
  },
  {
    title: "Everything stays on your phone",
    body:
      "No video content, captions, usernames, or screenshots are ever read or stored. ScrollTracker only observes structural signals — screen changes and scroll events — inside the apps you approve, and only counts to increment a number.",
  },
  {
    title: "Two permissions make this work",
    body:
      "Android requires an Accessibility Service to detect when you scroll to a new video, and Usage Access to measure time spent per app. Both are granted in system settings, not inside this app.",
  },
];

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const {
    accessibilityGranted,
    usageAccessGranted,
    notificationsGranted,
    openAccessibilitySettings,
    openUsageAccessSettings,
    requestNotifications,
    refresh,
    completeOnboarding,
  } = usePermissionsStore();

  const onFinish = async () => {
    await refresh();
    const state = usePermissionsStore.getState();
    if (!allRequiredPermissionsGranted(state)) return;
    completeOnboarding();
    await TrackingService.start();
    useTrackingStore.getState().setTrackingActive(true);
    router.replace("/(tabs)/dashboard");
  };

  const isLastStep = stepIndex === STEPS.length;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        {!isLastStep ? (
          <Animated.View entering={FadeIn} className="flex-1 justify-center">
            <Text className="text-accent text-sm font-semibold mb-2">
              Step {stepIndex + 1} of {STEPS.length}
            </Text>
            <Text className="text-white text-2xl font-bold mb-4">
              {STEPS[stepIndex].title}
            </Text>
            <Text className="text-muted text-base leading-6">
              {STEPS[stepIndex].body}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} className="flex-1 justify-center">
            <Text className="text-white text-2xl font-bold mb-6">
              Grant permissions
            </Text>

            <PermissionRow
              label="Accessibility Service"
              description="Detects scrolling and video changes"
              granted={accessibilityGranted}
              onPress={openAccessibilitySettings}
            />
            <PermissionRow
              label="Usage Access"
              description="Measures time spent per app"
              granted={usageAccessGranted}
              onPress={openUsageAccessSettings}
            />
            <PermissionRow
              label="Notifications"
              description="Alerts when you exceed a limit (optional)"
              granted={notificationsGranted}
              onPress={requestNotifications}
            />

            <Pressable
              onPress={() => refresh()}
              className="mt-2 py-3 items-center"
            >
              <Text className="text-accent text-sm">
                I've granted these — check again
              </Text>
            </Pressable>
          </Animated.View>
        )}

        <View className="pb-8 gap-3">
          {!isLastStep ? (
            <Pressable
              onPress={() => setStepIndex((i) => i + 1)}
              className="bg-primary rounded-2xl py-4 items-center"
            >
              <Text className="text-white font-semibold text-base">
                Continue
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onFinish}
              disabled={!accessibilityGranted || !usageAccessGranted}
              className={`rounded-2xl py-4 items-center ${
                accessibilityGranted && usageAccessGranted
                  ? "bg-primary"
                  : "bg-surfaceAlt"
              }`}
            >
              <Text className="text-white font-semibold text-base">
                Start Tracking
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {{label: string, description: string, granted: boolean, onPress: () => void}} props */
function PermissionRow({ label, description, granted, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt"
    >
      <View className="flex-1 pr-3">
        <Text className="text-white font-medium">{label}</Text>
        <Text className="text-muted text-xs mt-0.5">{description}</Text>
      </View>
      <View
        className={`w-6 h-6 rounded-full items-center justify-center ${
          granted ? "bg-success" : "bg-surfaceAlt"
        }`}
      >
        <Text className="text-white text-xs">{granted ? "✓" : ""}</Text>
      </View>
    </Pressable>
  );
}
