import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useCallback, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTrackingStore, selectDisplayCount } from "@/features/tracking/store/trackingStore";
import { usePermissionsStore } from "@/features/tracking/store/permissionsStore";
import { useGoalsStore } from "@/features/goals/store/goalsStore";
import { PlatformCard } from "@/shared/components/PlatformCard";
import { PermissionGateBanner } from "@/shared/components/PermissionGateBanner";
import { StatusChip } from "@/shared/components/StatusChip";
import { useState } from "react";

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const trackingState = useTrackingStore();
  const permissionsState = usePermissionsStore();
  const { goals, streak, load: loadGoals } = useGoalsStore();

  useEffect(() => {
    loadGoals();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      trackingState.refreshToday(),
      permissionsState.refresh(),
      loadGoals(),
    ]);
    setRefreshing(false);
  }, []);

  const missingPermissions = [
    permissionsState.accessibilityGranted,
    permissionsState.usageAccessGranted,
  ].filter((granted) => !granted).length;

  const totalVideosToday = trackingState.platforms.reduce(
    (sum, p) => sum + selectDisplayCount(trackingState, p.key),
    0
  );

  const isTrackingActive = trackingState.isTrackingActive && missingPermissions === 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="px-5 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
            colors={["#10B981"]}
          />
        }
      >
        {/* Header */}
        <View className="mb-5 mt-2">
          <Text className="text-text text-3xl font-bold mb-1">Dashboard</Text>
          <Text className="text-textMuted text-sm">Your short-form video count today</Text>
        </View>

        {/* Status chips */}
        <View className="flex-row gap-2 mb-5 flex-wrap">
          <StatusChip
            label={isTrackingActive ? "Tracking Active" : "Not Active"}
            active={isTrackingActive}
            icon={isTrackingActive ? "check-circle" : "alert-circle"}
          />
          <StatusChip
            label={permissionsState.accessibilityGranted ? "Permitted" : "No Access"}
            active={permissionsState.accessibilityGranted}
            icon={permissionsState.accessibilityGranted ? "check-circle-outline" : "close-circle-outline"}
          />
          {streak > 0 && (
            <StatusChip label={`${streak} day streak`} active icon="fire" />
          )}
        </View>

        <PermissionGateBanner missingCount={missingPermissions} />

        {/* Today's total */}
        <View className="bg-surface border border-outlineVariant rounded-2xl p-5 mb-5 flex-row items-center gap-4">
          <View className="w-14 h-14 rounded-2xl bg-primaryContainer items-center justify-center">
            <MaterialCommunityIcons name="eye-outline" size={28} color="#059669" />
          </View>
          <View>
            <Text className="text-textMuted text-sm mb-1">Total videos today</Text>
            <Text className="text-text text-4xl font-bold">{totalVideosToday}</Text>
          </View>
        </View>

        {/* Platform Cards */}
        <Text className="text-text text-lg font-semibold mb-3">By Platform</Text>

        {trackingState.isLoading ? (
          <View className="bg-surface rounded-2xl p-6 items-center border border-outlineVariant">
            <Text className="text-textMuted text-base">Loading...</Text>
          </View>
        ) : (
          trackingState.platforms.map((platform) => {
            const goal = goals.find(
              (g) => g.platformId === platform.id && g.goalType === "video_count"
            );
            return (
              <PlatformCard
                key={platform.key}
                platform={platform}
                videoCount={selectDisplayCount(trackingState, platform.key)}
                goalLimit={goal?.limitValue}
              />
            );
          })
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
