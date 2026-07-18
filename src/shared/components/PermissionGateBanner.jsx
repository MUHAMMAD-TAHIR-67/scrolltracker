import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

/** @param {{missingCount: number}} props */
export function PermissionGateBanner({ missingCount }) {
  if (missingCount === 0) return null;

  return (
    <Pressable
      onPress={() => router.push("/onboarding")}
      className="bg-errorContainer/10 border border-outline rounded-2xl p-4 mb-6 flex-row gap-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel="Fix permissions - tracking is not fully active"
    >
      <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F2B8B5" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-onSurfaceVariant text-title-small font-medium mb-1">Tracking isn't fully active</Text>
        <Text className="text-onSurfaceDisabled text-body-small">
          {missingCount === 1
            ? "1 permission still needs to be granted for accurate tracking."
            : `${missingCount} permissions still need to be granted for accurate tracking.`}{" "}
          Tap to finish setup.
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#938F99" />
    </Pressable>
  );
}
