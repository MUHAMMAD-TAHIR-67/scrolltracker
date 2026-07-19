import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function StatCard({ icon, label, value, color = "#10B981", subtitle }) {
  return (
    <View className="flex-1 bg-surface border border-outlineVariant rounded-2xl p-4">
      <MaterialCommunityIcons name={icon} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text className="text-text text-xl font-bold" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-textMuted text-xs mt-1" numberOfLines={1}>
        {label}
      </Text>
      {subtitle ? (
        <Text className="text-textMuted text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
