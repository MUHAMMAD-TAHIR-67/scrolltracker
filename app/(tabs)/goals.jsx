import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTrackingStore, selectDisplayCount } from "@/features/tracking/store/trackingStore";
import { useGoalsStore, goalProgress } from "@/features/goals/store/goalsStore";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { Card } from "@/shared/components/Card";

export default function GoalsScreen() {
  const trackingState = useTrackingStore();
  const { goals, load, setGoal } = useGoalsStore();
  const [editingPlatformId, setEditingPlatformId] = useState(null);
  const [draftLimit, setDraftLimit] = useState("");

  useEffect(() => {
    load();
  }, []);

  /** @param {import("@/features/tracking/types").Platform} platform */
  const startEditing = (platform) => {
    const existing = goals.find((g) => g.platformId === platform.id && g.goalType === "video_count");
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
      <ScrollView className="px-6 pt-2">
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-onBackground text-display-small font-normal mb-1">
            Daily Goals
          </Text>
          <Text className="text-onSurfaceVariant text-body-medium">
            Set limits to stay mindful of your usage
          </Text>
        </View>

        {/* Info Card */}
        <View className="bg-primaryContainer/20 rounded-2xl p-4 mb-6 border border-outlineVariant flex-row items-start gap-3">
          <MaterialCommunityIcons name="information-outline" size={24} color="#D0BCFF" style={{ marginTop: 2 }} />
          <View className="flex-1">
            <Text className="text-onSurfaceVariant text-title-small font-medium mb-1">How it works</Text>
            <Text className="text-onSurfaceVariant text-body-small leading-5">
              Set a daily video-count limit per platform. Focus Mode will alert you when you go over your limit.
            </Text>
          </View>
        </View>

        {/* Platform Goals */}
        {trackingState.platforms.map((platform) => {
          const goal = goals.find((g) => g.platformId === platform.id && g.goalType === "video_count");
          const videoCount = selectDisplayCount(trackingState, platform.key);
          const progress = goal ? goalProgress(goal, videoCount, 0) : 0;
          const isEditing = editingPlatformId === platform.id;

          return (
            <View
              key={platform.key}
              className="bg-surfaceContainer rounded-2xl p-5 mb-3 border border-outlineVariant"
              accessibilityRole="summary"
              accessibilityLabel={`${platform.displayName}: ${goal ? `${videoCount} of ${goal.limitValue} videos` : 'no limit set'}`}
            >
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-3">
                  <View 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: platform.colorHex }}
                    accessibilityHidden={true}
                  />
                  <Text className="text-onSurface text-title-medium font-medium">
                    {platform.displayName}
                  </Text>
                </View>
                {!isEditing && (
                  <Pressable 
                    onPress={() => startEditing(platform)} 
                    className="flex-row items-center gap-2 active:opacity-60"
                    accessibilityRole="button"
                    accessibilityLabel={goal ? "Edit goal" : "Set goal"}
                  >
                    <MaterialCommunityIcons 
                      name={goal ? "pencil-outline" : "plus-circle-outline"} 
                      size={20} 
                      color="#D0BCFF" 
                    />
                    <Text className="text-primary text-label-large font-medium">
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
                    className="flex-1 bg-surfaceContainerHigh text-onSurface rounded-xl px-4 py-3"
                    placeholder="Videos per day"
                    placeholderTextColor="#938F99"
                    accessibilityLabel="Daily video limit"
                  />
                  <Pressable
                    onPress={() => saveGoal(platform.id)}
                    className="bg-primaryContainer rounded-xl px-5 py-3 flex-row items-center gap-2 active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel="Save goal"
                  >
                    <MaterialCommunityIcons name="check" size={20} color="#381E72" />
                    <Text className="text-onPrimaryContainer text-label-large font-medium">Save</Text>
                  </Pressable>
                </View>
              ) : goal ? (
                <>
                  <View className="flex-row items-baseline gap-2 mb-3">
                    <Text className="text-onSurface text-display-small font-light">{videoCount}</Text>
                    <Text className="text-onSurfaceVariant text-body-medium">/ {goal.limitValue} videos today</Text>
                  </View>
                  <ProgressBar progress={progress} colorHex={platform.colorHex} height={8} />
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-onSurfaceVariant text-label-small">
                      {progress > 1 ? "Over limit" : `${Math.round(progress * 100)}% of daily limit`}
                    </Text>
                    <Text className={`text-label-large font-medium ${progress > 1 ? "text-error" : "text-success"}`}>
                      {Math.min(Math.round((videoCount / goal.limitValue) * 100), 100)}%
                    </Text>
                  </View>
                </>
              ) : (
                <View className="flex-row items-center gap-2 py-2">
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#938F99" />
                  <Text className="text-onSurfaceVariant text-body-medium">No limit set</Text>
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
