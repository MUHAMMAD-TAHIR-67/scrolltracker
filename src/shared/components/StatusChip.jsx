import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Modern Material 3 Status Chip component
 * @param {Object} props
 * @param {string} props.label - Chip label text
 * @param {boolean} [props.active] - Active state (default: false)
 * @param {string} [props.icon] - Optional icon name
 */
export function StatusChip({ label, active = false, icon }) {
  return (
    <View 
      className={`flex-row items-center px-4 py-2 rounded-full ${
        active ? "bg-primaryContainer" : "bg-surfaceContainerHigh"
      }`}
    >
      {icon && (
        <MaterialCommunityIcons 
          name={icon} 
          size={16} 
          color={active ? "#381E72" : "#CAC4D0"} 
          style={{ marginRight: 6 }} 
        />
      )}
      <Text 
        className={`${
          active ? "text-onPrimaryContainer" : "text-onSurfaceVariant"
        } text-label-large font-medium`}
      >
        {label}
      </Text>
    </View>
  );
}
