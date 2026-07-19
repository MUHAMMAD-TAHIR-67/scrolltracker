import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Simple Status Chip component
 */
export function StatusChip({ label, active = false, icon }) {
  return (
    <View 
      className={`flex-row items-center px-3 py-1.5 rounded-full ${
        active ? "bg-primary" : "bg-surfaceLight"
      }`}
    >
      {icon && (
        <MaterialCommunityIcons 
          name={icon} 
          size={14} 
          color={active ? "#FFFFFF" : "#94A3B8"} 
          style={{ marginRight: 4 }} 
        />
      )}
      <Text 
        className={`${
          active ? "text-white" : "text-textMuted"
        } text-xs font-medium`}
      >
        {label}
      </Text>
    </View>
  );
}
