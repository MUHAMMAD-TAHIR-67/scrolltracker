import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

/** Simple permission banner */
export function PermissionGateBanner({ missingCount }) {
  if (missingCount === 0) return null;

  return (
    <Pressable
      onPress={() => router.push("/onboarding")}
      className="bg-error/10 border border-error rounded-xl p-4 mb-5 flex-row gap-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel="Fix permissions - tracking is not fully active"
    >
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#EF4444" style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-text text-sm font-semibold mb-1">Tracking isn't fully active</Text>
        <Text className="text-textMuted text-xs">
          {missingCount === 1
            ? "1 permission still needs to be granted for accurate tracking."
            : `${missingCount} permissions still need to be granted for accurate tracking.`}{" "}
          Tap to finish setup.
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
    </Pressable>
  );
}
