import { View, Text } from "react-native";
import { ProgressBar } from "./ProgressBar";

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * @param {Object} props
 * @param {import("@/features/tracking/types").Platform} props.platform
 * @param {number} props.videoCount
 * @param {number} props.durationMs
 * @param {number} [props.goalLimit] video-count based limit, if any
 */
export function PlatformCard({ platform, videoCount, durationMs, goalLimit }) {
  const progress = goalLimit ? videoCount / goalLimit : 0;

  return (
    <View className="bg-surfaceContainer rounded-2xl p-5 mb-3 border border-outlineVariant">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center gap-3">
          <View 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: platform.colorHex }} 
          />
          <Text className="text-onSurface text-title-medium font-medium">{platform.displayName}</Text>
        </View>
        <View className="bg-surfaceContainerHigh rounded-full px-3 py-1.5">
          <Text className="text-onSurfaceVariant text-label-small font-medium">{formatDuration(durationMs)}</Text>
        </View>
      </View>

      <View className="flex-row items-baseline gap-2 mb-4">
        <Text className="text-onSurface text-display-small font-light">{videoCount}</Text>
        <Text className="text-onSurfaceVariant text-body-medium">videos</Text>
      </View>

      {goalLimit ? (
        <>
          <ProgressBar progress={progress} colorHex={platform.colorHex} />
          <View className="flex-row justify-between mt-2">
            <Text className="text-onSurfaceVariant text-label-small">
              {videoCount} / {goalLimit} daily limit
            </Text>
            <Text className={`text-label-small font-medium ${videoCount >= goalLimit ? "text-error" : "text-success"}`}>
              {Math.round((videoCount / goalLimit) * 100)}%
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
