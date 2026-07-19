import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Simple Card component with clean styling
 */
export function Card({ children, title, icon, iconColor = "#6366F1", noPadding = false }) {
  return (
    <View className="bg-surface rounded-xl mb-5 border border-gray-700">
      {(title || icon) && (
        <View className="flex-row items-center px-5 pt-4 pb-3">
          {icon && (
            <MaterialCommunityIcons 
              name={icon} 
              size={20} 
              color={iconColor} 
              style={{ marginRight: 8 }} 
            />
          )}
          {title && (
            <Text className="text-text text-lg font-semibold">
              {title}
            </Text>
          )}
        </View>
      )}
      <View className={noPadding ? "" : "px-5 pb-4"}>
        {children}
      </View>
    </View>
  );
}
