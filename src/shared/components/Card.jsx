import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Modern Material 3 Card component with consistent styling
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} [props.title] - Optional card title
 * @param {string} [props.icon] - Optional icon name
 * @param {string} [props.iconColor] - Icon color (default: primary)
 * @param {boolean} [props.noPadding] - Remove default padding
 */
export function Card({ children, title, icon, iconColor = "#D0BCFF", noPadding = false }) {
  return (
    <View className="bg-surfaceContainerHigh rounded-3xl mb-6 border border-outlineVariant">
      {(title || icon) && (
        <View className="flex-row items-center px-6 pt-5 pb-3">
          {icon && (
            <MaterialCommunityIcons 
              name={icon} 
              size={20} 
              color={iconColor} 
              style={{ marginRight: 8 }} 
            />
          )}
          {title && (
            <Text className="text-onSurfaceVariant text-title-small font-medium">
              {title}
            </Text>
          )}
        </View>
      )}
      <View className={noPadding ? "" : "px-6 pb-5"}>
        {children}
      </View>
    </View>
  );
}
