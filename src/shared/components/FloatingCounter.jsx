import { View, Text, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Small floating pill that shows the live swipe count.
 * Displayed on top of the dashboard when tracking is active.
 * Pulses each time a new video is counted.
 */
export function FloatingCounter({ videoCount = 0, isVisible = true }) {
  const fadeAnim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  // Pulse on count change
  useEffect(() => {
    if (videoCount === 0) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [videoCount]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 24,
        right: 20,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        zIndex: 100,
      }}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: "#10B981",
          borderRadius: 24,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 6,
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }}
      >
        <MaterialCommunityIcons name="gesture-swipe-up" size={16} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{videoCount}</Text>
      </View>
    </Animated.View>
  );
}
