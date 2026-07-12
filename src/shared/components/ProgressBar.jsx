import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect } from "react";

/**
 * @param {Object} props
 * @param {number} props.progress 0-1, can exceed 1 (will clamp visually but color signals overage)
 * @param {string} props.colorHex
 * @param {number} [props.height]
 */
export function ProgressBar({ progress, colorHex, height = 8 }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(progress, 1) * 100, { duration: 400 });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const isOverLimit = progress > 1;

  return (
    <View className="w-full rounded-full bg-surfaceAlt overflow-hidden" style={{ height }}>
      <Animated.View
        style={[style, { backgroundColor: isOverLimit ? "#F87171" : colorHex, height }]}
        className="rounded-full"
      />
    </View>
  );
}
