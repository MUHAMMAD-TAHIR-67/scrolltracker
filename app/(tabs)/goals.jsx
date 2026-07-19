import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTrackingStore, selectDisplayCount } from "@/features/tracking/store/trackingStore";
import { useGoalsStore, goalProgress } from "@/features/goals/store/goalsStore";
import { ProgressBar } from "@/shared/components/ProgressBar";

export default function GoalsScreen() {
  const trackingState = useTrackingStore();
  const { goals, load, setGoal } = useGoalsStore();
  const [editingPlatformId, setEditingPlatformId] = useState(null);
  const [draftLimit, setDraftLimit] = useState("");

  useEffect(() => {
    load();
  }, []);

  const startEditing = (platform) => {
    const existing = goals.find(
      (g) => g.platformId === platform.id && g.goalType === "video_count"
    );
    setEditingPlatformId(platform.id);
    setDraftLimit(existing ? String(existing.limitValue) : "30");
  };

  const saveGoal = async (platformId) => {
    const value = parseInt(draftLimit, 10);
    if (!Number.isNaN(value) && value > 0) {
      await setGoal(platformId, "video_count", value);
    }
    setEditingPlatformId(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="px-5 pt-2">
        {/* Header */}
        <View className="mb-5 mt-2">
          <Text className="text-text text-3xl font-bold mb-1">Daily Goals</Text>
          <Text className="text-textMuted text-sm">Set a daily video limit per platform</Text>
        </View>

        {/* Info card */}
        <View className="bg-primaryContainer border border-outlineVariant rounded-2xl p-4 mb-5 flex-row items-start gap-3">
          <MaterialCommunityIcons name="information-outline" size={22} color="#059669" style={{ marginTop: 1 }} />
          <View className="flex-1">
            <Text className="text-onPrimaryContainer text-sm font-semibold mb-1">How it works</Text>
            <Text className="text-onSurfaceVariant text-xs leading-5">
              Set a daily video-count limit per platform. Focus Mode will alert you when you go over.
            </Text>
          </View>
        </View>

        {/* Platform goals */}
        {trackingState.platforms.map((platform) => {
          const goal = goals.find(
            (g) => g.platformId === platform.id && g.goalType === "video_count"
          );
          const videoCount = selectDisplayCount(trackingState, platform.key);
          const progress = goal ? goalProgress(goal, videoCount, 0) : 0;
          const isEditing = editingPlatformId === platform.id;

          return (
            <View
              key={platform.key}
              className="bg-surface border border-outlineVariant rounded-2xl p-5 mb-3"
              accessibilityRole="summary"
              accessibilityLabel={`${platform.displayName}: ${goal ? `${videoCount} of ${goal.limitValue} videos` : "no limit set"}`}
            >
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-2">
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: platform.colorHex }}
                    accessibilityHidden
                  />
                  <Text className="text-text text-base font-semibold">{platform.displayName}</Text>
                </View>
                {!isEditing && (
                  <Pressable
                    onPress={() => startEditing(platform)}
                    className="flex-row items-center gap-1 active:opacity-60"
                    accessibilityRole="button"
                    accessibilityLabel={goal ? "Edit goal" : "Set goal"}
                  >
                    <MaterialCommunityIcons
                      name={goal ? "pencil-outline" : "plus-circle-outline"}
                      size={18}
                      color="#10B981"
                    />
                    <Text className="text-primary text-sm font-semibold">
                      {goal ? "Edit" : "Set limit"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {isEditing ? (
                <View className="flex-row items-center gap-3">
                  <TextInput
                    value={draftLimit}
                    onChangeText={setDraftLimit}
                    keyboardType="number-pad"
                    className="flex-1 bg-surfaceContainerHigh text-text rounded-xl px-4 py-3 text-base"
                    placeholder="Videos per day"
                    placeholderTextColor="#9CA3AF"
                    accessibilityLabel="Daily video limit"
                  />
                  <Pressable
                    onPress={() => saveGoal(platform.id)}
                    className="bg-primary rounded-xl px-5 py-3 flex-row items-center gap-2 active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel="Save goal"
                  >
                    <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                    <Text className="text-white text-sm font-semibold">Save</Text>
                  </Pressable>
                </View>
              ) : goal ? (
                <>
                  <View className="flex-row items-baseline gap-2 mb-3">
                    <Text className="text-primary text-3xl font-bold">{videoCount}</Text>
                    <Text className="text-textMuted text-sm">/ {goal.limitValue} videos today</Text>
                  </View>
                  <ProgressBar progress={progress} colorHex={platform.colorHex} height={8} />
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-textMuted text-xs">
                      {progress > 1 ? "Over limit" : `${Math.round(progress * 100)}% of daily limit`}
                    </Text>
                    <Text
                      className={`text-xs font-bold ${progress > 1 ? "text-error" : "text-success"}`}
                    >
                      {Math.min(Math.round((videoCount / goal.limitValue) * 100), 100)}%
                    </Text>
                  </View>
                </>
              ) : (
                <View className="flex-row items-center gap-2 py-1">
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#9CA3AF" />
                  <Text className="text-textMuted text-sm">No limit set</Text>
                </View>
              )}
            </View>
          );
        })}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
