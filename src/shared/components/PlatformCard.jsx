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
    <View className="bg-surface rounded-lg p-4 mb-3 border border-surfaceAlt shadow-sm">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.colorHex }} />
          <Text className="text-white font-semibold text-base">{platform.displayName}</Text>
        </View>
        <View className="bg-surfaceAlt rounded-full px-2 py-1">
          <Text className="text-muted text-xs font-medium">{formatDuration(durationMs)}</Text>
        </View>
      </View>

      <View className="flex-row items-baseline gap-2 mb-3">
        <Text className="text-white text-3xl font-bold">{videoCount}</Text>
        <Text className="text-muted text-sm">videos</Text>
      </View>

      {goalLimit ? (
        <>
          <ProgressBar progress={progress} colorHex={platform.colorHex} />
          <View className="flex-row justify-between mt-2">
            <Text className="text-muted text-xs">
              {videoCount} / {goalLimit} daily limit
            </Text>
            <Text className={`text-xs font-medium ${videoCount >= goalLimit ? "text-danger" : "text-success"}`}>
              {Math.round((videoCount / goalLimit) * 100)}%
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
