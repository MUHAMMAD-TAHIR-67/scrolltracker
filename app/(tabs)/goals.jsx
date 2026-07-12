import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="px-5 pt-2">
        <Text className="text-white text-2xl font-bold mb-1 mt-2">Daily Goals</Text>
        <Text className="text-muted text-sm mb-5">
          Set a daily video-count limit per platform. Focus Mode alerts you when you go over.
        </Text>

        {trackingState.platforms.map((platform) => {
          const goal = goals.find((g) => g.platformId === platform.id && g.goalType === "video_count");
          const videoCount = selectDisplayCount(trackingState, platform.key);
          const progress = goal ? goalProgress(goal, videoCount, 0) : 0;
          const isEditing = editingPlatformId === platform.id;

          return (
            <View
              key={platform.key}
              className="bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt"
            >
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.colorHex }} />
                  <Text className="text-white font-semibold">{platform.displayName}</Text>
                </View>
                {!isEditing && (
                  <Pressable onPress={() => startEditing(platform)}>
                    <Text className="text-accent text-sm">
                      {goal ? "Edit" : "Set limit"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {isEditing ? (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={draftLimit}
                    onChangeText={setDraftLimit}
                    keyboardType="number-pad"
                    className="flex-1 bg-surfaceAlt text-white rounded-xl px-3 py-2"
                    placeholder="Videos per day"
                    placeholderTextColor="#94A3B8"
                  />
                  <Pressable
                    onPress={() => saveGoal(platform.id)}
                    className="bg-primary rounded-xl px-4 py-2"
                  >
                    <Text className="text-white font-medium">Save</Text>
                  </Pressable>
                </View>
              ) : goal ? (
                <>
                  <ProgressBar progress={progress} colorHex={platform.colorHex} />
                  <Text className="text-muted text-xs mt-1">
                    {videoCount} / {goal.limitValue} videos today
                    {progress > 1 ? " — over limit" : ""}
                  </Text>
                </>
              ) : (
                <Text className="text-muted text-sm">No limit set</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
