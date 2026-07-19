import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect } from "react";

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
    <View
      className="w-full rounded-full bg-surfaceContainerHigh"
      style={{ height }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View
        style={[style, { backgroundColor: isOverLimit ? "#DC2626" : colorHex, height }]}
        className="rounded-full"
      />
    </View>
  );
}
