import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusStore } from "@/features/focus/services/FocusModeService";

const PRESETS_MIN = [15, 30, 60, 120];

export default function FocusScreen() {
  const { isActive, remainingMs, plannedMs, start, end } = useFocusStore();

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const progress = plannedMs > 0 ? 1 - remainingMs / plannedMs : 0;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-6 items-center justify-center">
        {isActive ? (
          <>
            <MaterialCommunityIcons name="timer" size={48} color="#6366F1" style={{ marginBottom: 16 }} />
            <View className="w-56 h-56 rounded-full border-8 border-surfaceAlt items-center justify-center mb-8">
              <View
                className="absolute w-56 h-56 rounded-full border-8 border-accent"
                style={{
                  opacity: 0.9,
                  transform: [{ rotate: `${progress * 360}deg` }],
                }}
              />
              <Text className="text-white text-4xl font-bold">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </Text>
              <Text className="text-muted text-sm mt-1">remaining</Text>
            </View>
            <Text className="text-white text-center mb-6 px-4">
              Short-form apps will alert you if opened during this session.
            </Text>
            <Pressable
              onPress={() => end(true)}
              className="bg-danger/10 border border-danger rounded-lg px-6 py-3 flex-row items-center gap-2 active:opacity-80"
            >
              <MaterialCommunityIcons name="stop-circle" size={16} color="#EF4444" />
              <Text className="text-danger font-semibold">End Focus Session</Text>
            </Pressable>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="brain" size={48} color="#6366F1" style={{ marginBottom: 16 }} />
            <Text className="text-white text-2xl font-bold mb-2">Focus Mode</Text>
            <Text className="text-muted text-center mb-8 px-4">
              Start a session and get alerted the moment you open Reels, Shorts,
              TikTok, or Spotlight.
            </Text>
            <View className="flex-row flex-wrap gap-3 justify-center">
              {PRESETS_MIN.map((min) => (
                <Pressable
                  key={min}
                  onPress={() => start(min * 60_000)}
                  className="bg-surface border border-surfaceAlt rounded-lg px-4 py-3 w-24 items-center active:opacity-80"
                >
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#14B8A6" style={{ marginBottom: 4 }} />
                  <Text className="text-white text-lg font-bold">{min}</Text>
                  <Text className="text-muted text-xs">min</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
