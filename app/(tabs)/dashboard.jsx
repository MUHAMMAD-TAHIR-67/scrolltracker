import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTrackingStore, selectDisplayCount } from "@/features/tracking/store/trackingStore";
import { usePermissionsStore, allRequiredPermissionsGranted } from "@/features/tracking/store/permissionsStore";
import { useGoalsStore, goalProgress } from "@/features/goals/store/goalsStore";
import { PlatformCard } from "@/shared/components/PlatformCard";
import { PermissionGateBanner } from "@/shared/components/PermissionGateBanner";

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
    await Promise.all([trackingState.refreshToday(), permissionsState.refresh(), loadGoals()]);
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

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="px-5 pt-2"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22D3EE" />}
      >
        <View className="flex-row justify-between items-center mb-1 mt-2">
          <Text className="text-white text-2xl font-bold">Today</Text>
          {streak > 0 ? (
            <View className="flex-row items-center bg-surface rounded-full px-3 py-1">
              <Text className="text-warn text-sm font-semibold">🔥 {streak} day streak</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-muted text-sm mb-4">
          {totalVideosToday} short-form videos watched so far
        </Text>

        <PermissionGateBanner missingCount={missingPermissions} />

        {trackingState.isLoading ? (
          <Text className="text-muted">Loading...</Text>
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
                durationMs={trackingState.todayStats[platform.key]?.totalDurationMs ?? 0}
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
