import { View, Text } from "react-native";
import { ProgressBar } from "./ProgressBar";

/**
 * Shows video count for a single platform.
 * Time tracking display has been removed — swipe count only.
 */
export function PlatformCard({ platform, videoCount, goalLimit }) {
  const progress = goalLimit ? videoCount / goalLimit : 0;
  const isOverLimit = progress > 1;

  return (
    <View
      className="bg-surface border border-outlineVariant rounded-2xl p-4 mb-3"
      accessibilityRole="summary"
      accessibilityLabel={`${platform.displayName}: ${videoCount} videos watched today`}
    >
      {/* Platform name row */}
      <View className="flex-row items-center gap-2 mb-3">
        <View
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: platform.colorHex }}
          accessibilityHidden
        />
        <Text className="text-text text-base font-semibold">{platform.displayName}</Text>
      </View>

      {/* Video count */}
      <View className="flex-row items-baseline gap-2 mb-3">
        <Text className="text-primary text-4xl font-bold">{videoCount}</Text>
        <Text className="text-textMuted text-sm">videos today</Text>
      </View>

      {/* Goal progress */}
      {goalLimit ? (
        <>
          <ProgressBar
            progress={progress}
            colorHex={isOverLimit ? "#DC2626" : platform.colorHex}
            height={6}
          />
          <View className="flex-row justify-between mt-2">
            <Text className="text-textMuted text-xs">
              {videoCount} / {goalLimit} daily limit
            </Text>
            <Text
              className={`text-xs font-semibold ${isOverLimit ? "text-error" : "text-success"}`}
            >
              {Math.min(Math.round(progress * 100), 100)}%
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
