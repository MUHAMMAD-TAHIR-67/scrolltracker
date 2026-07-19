import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function Card({ children, title, icon, iconColor = "#10B981", noPadding = false }) {
  return (
    <View className="bg-surface border border-outlineVariant rounded-2xl mb-4">
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
            <Text className="text-text text-base font-semibold">{title}</Text>
          )}
        </View>
      )}
      <View className={noPadding ? "" : "px-5 pb-4"}>{children}</View>
    </View>
  );
}
