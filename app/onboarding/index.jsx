import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  usePermissionsStore,
  allRequiredPermissionsGranted,
} from "@/features/tracking/store/permissionsStore";
import { TrackingService } from "@/features/tracking/services/TrackingService";
import { useTrackingStore } from "@/features/tracking/store/trackingStore";

const STEPS = [
  {
    icon: "chart-timeline-variant",
    title: "Understand your scrolling",
    body:
      "ScrollTracker counts how many Reels, Shorts, TikToks, and Spotlight videos you watch, and how long you spend on each — so you can see the pattern, not just feel it.",
  },
  {
    icon: "shield-check-outline",
    title: "Everything stays on your phone",
    body:
      "No video content, captions, usernames, or screenshots are ever read or stored. ScrollTracker only observes structural signals — screen changes and scroll events — inside the apps you approve, and only counts to increment a number.",
  },
  {
    icon: "key-outline",
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
    batteryOptimizationIgnored,
    openAccessibilitySettings,
    openUsageAccessSettings,
    requestNotifications,
    requestBatteryOptimizationExemption,
    openAutostartSettings,
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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        {!isLastStep ? (
          <Animated.View entering={FadeIn} className="flex-1 justify-center py-8">
            {/* Progress Indicator */}
            <View className="flex-row items-center gap-2 mb-8">
              {STEPS.map((_, index) => (
                <View
                  key={index}
                  className={`h-1 flex-1 rounded-full ${
                    index <= stepIndex ? "bg-primary" : "bg-surfaceContainerHighest"
                  }`}
                />
              ))}
            </View>

            {/* Icon */}
            <View className="w-20 h-20 rounded-3xl bg-primaryContainer items-center justify-center mb-6">
              <MaterialCommunityIcons name={STEPS[stepIndex].icon} size={40} color="#381E72" />
            </View>

            <Text className="text-onSurfaceVariant text-label-large font-medium mb-2">
              Step {stepIndex + 1} of {STEPS.length}
            </Text>
            <Text className="text-onBackground text-headline-medium font-normal mb-4">
              {STEPS[stepIndex].title}
            </Text>
            <Text className="text-onSurfaceVariant text-body-large leading-7">
              {STEPS[stepIndex].body}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} className="flex-1 justify-center py-8">
            <View className="w-20 h-20 rounded-3xl bg-primaryContainer items-center justify-center mb-6">
              <MaterialCommunityIcons name="lock-open-outline" size={40} color="#381E72" />
            </View>
            
            <Text className="text-onBackground text-headline-medium font-normal mb-2">
              Grant permissions
            </Text>
            <Text className="text-onSurfaceVariant text-body-medium mb-6">
              These permissions enable ScrollTracker to monitor your short-form video usage.
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
            <PermissionRow
              label="Background Battery Access"
              description="Prevents Android from killing tracking"
              granted={batteryOptimizationIgnored}
              onPress={requestBatteryOptimizationExemption}
            />
            <Pressable
              onPress={openAutostartSettings}
              className="bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Open autostart settings for Xiaomi, Vivo, Oppo, or Huawei devices"
            >
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons name="power-plug-outline" size={24} color="#D0BCFF" />
                <View className="flex-1">
                  <Text className="text-onSurface text-body-large">Xiaomi / Vivo / Oppo / Huawei</Text>
                  <Text className="text-onSurfaceVariant text-body-small mt-0.5">
                    Enable autostart if tracking stops in background
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#938F99" />
              </View>
            </Pressable>

            <Pressable
              onPress={() => refresh()}
              className="mt-2 py-3 items-center"
              accessibilityRole="button"
              accessibilityLabel="Refresh permission status"
            >
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="refresh" size={18} color="#D0BCFF" />
                <Text className="text-primary text-label-large font-medium">
                  I've granted these — check again
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        <View className="pb-8 gap-3">
          {!isLastStep ? (
            <Pressable
              onPress={() => setStepIndex((i) => i + 1)}
              className="bg-primaryContainer rounded-2xl py-4 px-6 flex-row items-center justify-between active:opacity-70"
              accessibilityRole="button"
            >
              <Text className="text-onPrimaryContainer text-label-large font-medium">Continue</Text>
              <MaterialCommunityIcons name="arrow-right" size={24} color="#381E72" />
            </Pressable>
          ) : (
            <Pressable
              onPress={onFinish}
              disabled={!accessibilityGranted || !usageAccessGranted}
              className={`rounded-2xl py-4 px-6 flex-row items-center justify-between active:opacity-70 ${
                accessibilityGranted && usageAccessGranted
                  ? "bg-primaryContainer"
                  : "bg-surfaceContainerHighest"
              }`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !accessibilityGranted || !usageAccessGranted }}
            >
              <Text className={`${
                accessibilityGranted && usageAccessGranted 
                  ? "text-onPrimaryContainer" 
                  : "text-onSurfaceDisabled"
              } text-label-large font-medium`}>
                Start Tracking
              </Text>
              {accessibilityGranted && usageAccessGranted && (
                <MaterialCommunityIcons name="check-circle" size={24} color="#381E72" />
              )}
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
      className="flex-row items-center justify-between bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${label} - ${granted ? "granted" : "not granted"}`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-onSurface text-body-large">{label}</Text>
        <Text className="text-onSurfaceVariant text-body-small mt-0.5">{description}</Text>
      </View>
      <View
        className={`w-8 h-8 rounded-full items-center justify-center ${
          granted ? "bg-success" : "bg-surfaceContainerHighest"
        }`}
      >
        <MaterialCommunityIcons
          name={granted ? "check" : "close"}
          size={18}
          color={granted ? "#1D1B20" : "#938F99"}
        />
      </View>
    </Pressable>
  );
}