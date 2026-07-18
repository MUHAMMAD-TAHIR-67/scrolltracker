import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform } from "react-native";

/** @type {Record<string, {icon: string, label: string}>} */
const TAB_CONFIG = {
  dashboard: { icon: "view-dashboard", label: "Dashboard" },
  analytics: { icon: "chart-bar", label: "Analytics" },
  goals: { icon: "target", label: "Goals" },
  focus: { icon: "timer-outline", label: "Focus" },
  settings: { icon: "cog-outline", label: "Settings" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#D0BCFF",
        tabBarInactiveTintColor: "#938F99",
        tabBarStyle: {
          backgroundColor: "#1D1B20",
          borderTopColor: "#49454F",
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 80,
          paddingBottom: Platform.OS === 'ios' ? 8 : 0,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const config = TAB_CONFIG[route.name];
          return (
            <MaterialCommunityIcons 
              name={config.icon} 
              size={focused ? 24 : 24} 
              color={color} 
            />
          );
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics" }} />
      <Tabs.Screen name="goals" options={{ title: "Goals" }} />
      <Tabs.Screen name="focus" options={{ title: "Focus" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
