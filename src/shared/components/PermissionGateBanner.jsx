import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";

/** @param {{missingCount: number}} props */
export function PermissionGateBanner({ missingCount }) {
  if (missingCount === 0) return null;

  return (
    <Pressable
      onPress={() => router.push("/onboarding")}
      className="bg-warn/20 border border-warn rounded-2xl p-4 mb-4"
    >
      <Text className="text-warn font-semibold mb-1">Tracking isn't fully active</Text>
      <Text className="text-white/80 text-sm">
        {missingCount === 1
          ? "1 permission still needs to be granted for accurate tracking."
          : `${missingCount} permissions still need to be granted for accurate tracking.`}{" "}
        Tap to finish setup.
      </Text>
    </Pressable>
  );
}
