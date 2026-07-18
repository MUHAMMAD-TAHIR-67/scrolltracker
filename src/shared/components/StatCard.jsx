import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Modern Material 3 Stat Card component
 * @param {Object} props
 * @param {string} props.icon - Material icon name
 * @param {string} props.label - Label text
 * @param {string} props.value - Value text
 * @param {string} [props.color] - Icon color (default: primary)
 * @param {string} [props.subtitle] - Optional subtitle
 */
export function StatCard({ icon, label, value, color = "#D0BCFF", subtitle }) {
  return (
    <View className="flex-1 bg-surfaceContainerHigh rounded-2xl p-4 border border-outlineVariant">
      <MaterialCommunityIcons name={icon} size={24} color={color} style={{ marginBottom: 8 }} />
      <Text className="text-onSurface text-headline-small font-light" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-onSurfaceVariant text-label-small mt-1" numberOfLines={1}>
        {label}
      </Text>
      {subtitle && (
        <Text className="text-onSurfaceDisabled text-label-small mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
