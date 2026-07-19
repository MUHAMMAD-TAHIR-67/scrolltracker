import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTrackingStore, selectDisplayCount } from "@/features/tracking/store/trackingStore";
import { usePermissionsStore, allRequiredPermissionsGranted } from "@/features/tracking/store/permissionsStore";
import { useGoalsStore, goalProgress } from "@/features/goals/store/goalsStore";
import { PlatformCard } from "@/shared/components/PlatformCard";
import { PermissionGateBanner } from "@/shared/components/PermissionGateBanner";
import { Card } from "@/shared/components/Card";
import { StatusChip } from "@/shared/components/StatusChip";

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
  
  const isTrackingActive = trackingState.isTrackingActive && !missingPermissions;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="px-5 pt-2"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#6366F1" 
          />
        }
      >
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-text text-3xl font-bold mb-1">
            Dashboard
          </Text>
          <Text className="text-textMuted text-base">
            Track your short-form video usage
          </Text>
        </View>

        {/* Status Bar */}
        <View className="flex-row gap-2 mb-6 flex-wrap">
          <StatusChip 
            label={isTrackingActive ? "Tracking Active" : "Tracking Inactive"} 
            active={isTrackingActive}
            icon={isTrackingActive ? "check-circle" : "pause-circle"}
          />
          <StatusChip 
            label={permissionsState.accessibilityGranted ? "Accessibility On" : "Accessibility Off"} 
            active={permissionsState.accessibilityGranted}
            icon={permissionsState.accessibilityGranted ? "eye-outline" : "eye-off-outline"}
          />
          {streak > 0 && (
            <StatusChip 
              label={`${streak} day streak`} 
              active={true}
              icon="fire"
            />
          )}
        </View>

        <PermissionGateBanner missingCount={missingPermissions} />

        {/* Today's Summary Card */}
        <Card title="Today's Overview" icon="calendar" iconColor="#6366F1">
          <View className="flex-row gap-4 mb-4">
            <View className="flex-1 bg-surfaceLight rounded-xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialCommunityIcons name="eye-outline" size={18} color="#22C55E" />
                <Text className="text-textMuted text-sm">Videos</Text>
              </View>
              <Text className="text-text text-2xl font-bold">
                {totalVideosToday}
              </Text>
            </View>
            <View className="flex-1 bg-surfaceLight rounded-xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialCommunityIcons name="clock-outline" size={18} color="#6366F1" />
                <Text className="text-textMuted text-sm">Time</Text>
              </View>
              <Text className="text-text text-2xl font-bold">
                {formatTotalTime(totalTimeTodayMs)}
              </Text>
            </View>
          </View>
          
          <View className="bg-primary/10 rounded-xl px-4 py-3 flex-row items-center gap-3">
            <MaterialCommunityIcons name="trending-up" size={20} color="#6366F1" />
            <View className="flex-1">
              <Text className="text-text text-sm font-semibold">
                Stay mindful
              </Text>
              <Text className="text-textMuted text-xs">
                Track your progress throughout the day
              </Text>
            </View>
          </View>
        </Card>

        {/* Platform Cards Section */}
        <View className="mb-2">
          <Text className="text-text text-lg font-semibold mb-4">
            Platforms
          </Text>
          
          {trackingState.isLoading ? (
            <View className="bg-surface rounded-xl p-6 items-center">
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
