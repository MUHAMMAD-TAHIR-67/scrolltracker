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
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 items-center justify-center">
        {isActive ? (
          <>
            <MaterialCommunityIcons name="timer" size={48} color="#6366F1" style={{ marginBottom: 24 }} />
            <View className="w-64 h-64 rounded-full border-8 border-surfaceLight items-center justify-center mb-8">
              <View
                className="absolute w-64 h-64 rounded-full border-8 border-primary"
                style={{
                  opacity: 0.9,
                  transform: [{ rotate: `${progress * 360}deg` }],
                }}
              />
              <Text className="text-text text-3xl font-bold">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </Text>
              <Text className="text-textMuted text-sm mt-2">remaining</Text>
            </View>
            <Text className="text-textMuted text-base text-center mb-8 px-6">
              Short-form apps will alert you if opened during this session.
            </Text>
            <Pressable
              onPress={() => end(true)}
              className="bg-error/10 border border-error rounded-xl px-6 py-4 flex-row items-center gap-3 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="End focus session"
            >
              <MaterialCommunityIcons name="stop-circle" size={24} color="#EF4444" />
              <Text className="text-error text-base font-semibold">End Focus Session</Text>
            </Pressable>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="brain" size={48} color="#6366F1" style={{ marginBottom: 24 }} />
            <Text className="text-text text-2xl font-bold mb-2 text-center">
              Focus Mode
            </Text>
            <Text className="text-textMuted text-base text-center mb-10 px-6">
              Start a session and get alerted the moment you open Reels, Shorts, TikTok, or Spotlight.
            </Text>
            <View className="flex-row flex-wrap gap-4 justify-center">
              {PRESETS_MIN.map((min) => (
                <Pressable
                  key={min}
                  onPress={() => start(min * 60_000)}
                  className="bg-surface border border-gray-700 rounded-xl px-6 py-5 items-center active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${min} minute focus session`}
                >
                  <MaterialCommunityIcons name="clock-outline" size={24} color="#22C55E" style={{ marginBottom: 8 }} />
                  <Text className="text-text text-2xl font-bold">{min}</Text>
                  <Text className="text-textMuted text-xs">min</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
