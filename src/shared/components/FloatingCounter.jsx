import { View, Text, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Floating counter that displays at the bottom-right of the screen.
 * Shows how many videos have been watched in the current session.
 * Uses light green theme with smooth animations.
 */
export function FloatingCounter({ videoCount = 0, isVisible = true }) {
  const fadeAnim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, fadeAnim]);

  // Pulse animation when count changes
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [videoCount, scaleAnim]);

  return (
    <Animated.View
      className="absolute bottom-8 right-6 bg-primary rounded-full shadow-lg"
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <View className="w-16 h-16 bg-primary rounded-full items-center justify-center shadow-md border-2 border-white">
        <View className="items-center justify-center">
          <MaterialCommunityIcons name="eye-outline" size={20} color="white" />
          <Text className="text-white text-sm font-bold mt-1">{videoCount}</Text>
        </View>
      </View>
    </Animated.View>
  );
}
