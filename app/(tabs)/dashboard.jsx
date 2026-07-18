import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

  const totalTimeTodayMs = trackingState.platforms.reduce(
    (sum, p) => sum + (trackingState.todayStats[p.key]?.totalDurationMs ?? 0),
    0
  );

  const formatTotalTime = (ms) => {
    const totalMinutes = Math.round(ms / 60_000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="px-6 pt-2"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D0BCFF" />}
      >
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-onBackground text-headline-large font-normal mb-1">Dashboard</Text>
          <Text className="text-onSurfaceVariant text-body-medium">Track your short-form video usage</Text>
        </View>

        {/* Today's Summary Card */}
        <View className="bg-surfaceContainerHigh rounded-3xl p-6 mb-6">
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons name="today" size={20} color="#D0BCFF" style={{ marginRight: 8 }} />
            <Text className="text-onSurfaceVariant text-title-small font-medium">Today's Overview</Text>
          </View>
          
          <View className="flex-row gap-4">
            <View className="flex-1 bg-surfaceContainerHighest rounded-2xl p-4">
              <Text className="text-onSurfaceDisabled text-label-medium mb-1">Videos Watched</Text>
              <Text className="text-onSurface text-display-small font-light">{totalVideosToday}</Text>
            </View>
            <View className="flex-1 bg-surfaceContainerHighest rounded-2xl p-4">
              <Text className="text-onSurfaceDisabled text-label-medium mb-1">Time Spent</Text>
              <Text className="text-onSurface text-headline-medium font-light">{formatTotalTime(totalTimeTodayMs)}</Text>
            </View>
          </View>
          
          {streak > 0 && (
            <View className="flex-row items-center mt-4 bg-primaryContainer/20 rounded-xl px-4 py-2">
              <MaterialCommunityIcons name="fire" size={18} color="#FFC66D" style={{ marginRight: 8 }} />
              <Text className="text-onSurfaceVariant text-label-large">{streak} day streak</Text>
            </View>
          )}
        </View>

        <PermissionGateBanner missingCount={missingPermissions} />

        {/* Platform Cards Section */}
        <View className="mb-2">
          <Text className="text-onSurfaceVariant text-title-medium font-medium mb-4">Platforms</Text>
          
          {trackingState.isLoading ? (
            <View className="bg-surfaceContainer rounded-2xl p-6 items-center">
              <Text className="text-onSurfaceVariant text-body-medium">Loading...</Text>
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
                  durationMs={trackingState.todayStats[platform.key]?.totalDurationMs ?? 0}
                  goalLimit={goal?.limitValue}
                />
              );
            })
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
