import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

/** @param {{missingCount: number}} props */
export function PermissionGateBanner({ missingCount }) {
  if (missingCount === 0) return null;

  return (
    <Pressable
      onPress={() => router.push("/onboarding")}
      className="bg-warn/10 border border-warn rounded-lg p-4 mb-4 flex-row gap-3 active:opacity-80"
    >
      <MaterialCommunityIcons name="alert-circle" size={20} color="#FF6B35" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-warn font-semibold mb-1">Tracking isn't fully active</Text>
        <Text className="text-white/80 text-sm">
          {missingCount === 1
            ? "1 permission still needs to be granted for accurate tracking."
            : `${missingCount} permissions still need to be granted for accurate tracking.`}{" "}
          Tap to finish setup.
        </Text>
      </View>
    </Pressable>
  );
}
