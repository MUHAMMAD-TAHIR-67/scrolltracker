import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ProgressBar } from "./ProgressBar";

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Simple Platform Card component
 */
export function PlatformCard({ platform, videoCount, durationMs, goalLimit }) {
  const progress = goalLimit ? videoCount / goalLimit : 0;
  const isOverLimit = progress > 1;

  return (
    <View 
      className="bg-surface rounded-xl p-4 mb-3 border border-gray-700"
      accessibilityRole="summary"
      accessibilityLabel={`${platform.displayName}: ${videoCount} videos watched today`}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          <View 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: platform.colorHex }}
            accessibilityHidden={true}
          />
          <Text className="text-text text-base font-semibold">
            {platform.displayName}
          </Text>
        </View>
        <View className="bg-surfaceLight rounded-full px-3 py-1 flex-row items-center gap-1.5">
          <MaterialCommunityIcons name="clock-outline" size={14} color="#94A3B8" />
          <Text className="text-textMuted text-xs font-medium">
            {formatDuration(durationMs)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-baseline gap-2 mb-3">
        <Text className="text-text text-3xl font-bold">{videoCount}</Text>
        <Text className="text-textMuted text-sm">videos today</Text>
      </View>

      {goalLimit ? (
        <>
          <ProgressBar progress={progress} colorHex={isOverLimit ? "#EF4444" : platform.colorHex} />
          <View className="flex-row justify-between mt-2">
            <Text className="text-textMuted text-xs">
              {videoCount} / {goalLimit} daily limit
            </Text>
            <Text 
              className={`text-xs font-semibold ${
                isOverLimit ? "text-error" : "text-success"
              }`}
            >
              {Math.min(Math.round(progress * 100), 100)}%
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
