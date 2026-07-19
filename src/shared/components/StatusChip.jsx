import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function StatusChip({ label, active = false, icon }) {
  return (
    <View
      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
        active
          ? "bg-primary border-primary"
          : "bg-surface border-outlineVariant"
      }`}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={13}
          color={active ? "#FFFFFF" : "#9CA3AF"}
          style={{ marginRight: 4 }}
        />
      )}
      <Text className={`text-xs font-semibold ${active ? "text-white" : "text-textMuted"}`}>
        {label}
      </Text>
    </View>
  );
}
