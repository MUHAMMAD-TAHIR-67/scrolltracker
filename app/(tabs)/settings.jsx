import { useEffect } from "react";
import { View, Text, Switch, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { usePermissionsStore } from "@/features/tracking/store/permissionsStore";
import { exportSessionsCsv } from "@/features/analytics/utils/csvExport";

const THRESHOLD_OPTIONS = [10, 20, 30, 45, 60];

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const permissions = usePermissionsStore();

  useEffect(() => {
    settings.load();
    permissions.refresh();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="px-5 pt-2">
        {/* Header */}
        <View className="mb-5 mt-2">
          <Text className="text-text text-3xl font-bold mb-1">Settings</Text>
          <Text className="text-textMuted text-sm">Manage permissions and preferences</Text>
        </View>

        {/* Permissions */}
        <Text className="text-textMuted text-xs font-semibold uppercase tracking-widest mb-3">
          Permissions
        </Text>

        <StatusRow
          label="Accessibility Service"
          description="Detects scrolling and video changes"
          ok={permissions.accessibilityGranted}
          onPress={permissions.openAccessibilitySettings}
        />
        <StatusRow
          label="Usage Access"
          description="Required for session tracking"
          ok={permissions.usageAccessGranted}
          onPress={permissions.openUsageAccessSettings}
        />
        <StatusRow
          label="Notifications"
          description="Alerts when you exceed a limit"
          ok={permissions.notificationsGranted}
          onPress={permissions.requestNotifications}
        />
        <StatusRow
          label="Background Battery Access"
          description="Prevents Android from killing tracking"
          ok={permissions.batteryOptimizationIgnored}
          onPress={permissions.requestBatteryOptimizationExemption}
        />
        <Pressable
          onPress={permissions.openAutostartSettings}
          className="bg-surface border border-outlineVariant rounded-2xl p-4 mb-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Open autostart settings for Xiaomi, Vivo, Oppo, or Huawei devices"
        >
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons name="power-plug-outline" size={22} color="#10B981" />
            <View className="flex-1">
              <Text className="text-text text-sm font-medium">Xiaomi / Vivo / Oppo / Huawei</Text>
              <Text className="text-textMuted text-xs mt-0.5">
                Enable autostart if tracking stops in background
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
          </View>
        </Pressable>

        {/* Notifications */}
        <Text className="text-textMuted text-xs font-semibold uppercase tracking-widest mb-3 mt-4">
          Notifications
        </Text>

        <View className="bg-surface border border-outlineVariant rounded-2xl p-4 mb-3">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-3">
              <Text className="text-text text-sm font-medium">Daily Limit Alerts</Text>
              <Text className="text-textMuted text-xs mt-0.5">
                Get notified when you reach your daily goal
              </Text>
            </View>
            <Switch
              value={settings.dailyLimitNotificationsEnabled}
              onValueChange={settings.toggleDailyLimitNotifications}
              trackColor={{ false: "#D1FAE5", true: "#10B981" }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle daily limit alerts"
            />
          </View>
        </View>

        <View className="bg-surface border border-outlineVariant rounded-2xl p-4 mb-3">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-text text-sm font-medium">Excessive Scrolling Alerts</Text>
              <Text className="text-textMuted text-xs mt-0.5">Alert after continuous scrolling for:</Text>
            </View>
            <Switch
              value={settings.excessiveScrollNotificationsEnabled}
              onValueChange={settings.toggleExcessiveScrollNotifications}
              trackColor={{ false: "#D1FAE5", true: "#10B981" }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle excessive scrolling alerts"
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {THRESHOLD_OPTIONS.map((min) => (
              <Pressable
                key={min}
                onPress={() => settings.setExcessiveScrollThreshold(min)}
                className={`px-4 py-2 rounded-full border ${
                  settings.excessiveScrollThresholdMin === min
                    ? "bg-primary border-primary"
                    : "bg-surfaceContainerHigh border-outlineVariant"
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.excessiveScrollThresholdMin === min }}
                accessibilityLabel={`${min} minutes threshold`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    settings.excessiveScrollThresholdMin === min ? "text-white" : "text-textMuted"
                  }`}
                >
                  {min}m
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Data */}
        <Text className="text-textMuted text-xs font-semibold uppercase tracking-widest mb-3 mt-4">
          Data
        </Text>

        <Pressable
          onPress={() => exportSessionsCsv()}
          className="bg-surface border border-outlineVariant rounded-2xl p-4 mb-3 flex-row items-center gap-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Export statistics as CSV file"
        >
          <MaterialCommunityIcons name="file-export-outline" size={22} color="#10B981" />
          <Text className="text-text text-sm font-medium flex-1">Export statistics as CSV</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
        </Pressable>

        {/* Privacy */}
        <View className="bg-primaryContainer border border-outlineVariant rounded-2xl p-5 mb-8 mt-2">
          <View className="flex-row items-center mb-2 gap-2">
            <MaterialCommunityIcons name="shield-check-outline" size={22} color="#059669" />
            <Text className="text-onPrimaryContainer text-sm font-bold">Your Privacy</Text>
          </View>
          <Text className="text-onSurfaceVariant text-xs leading-5">
            All tracking data lives only in this app&apos;s local SQLite database. ScrollTracker
            never reads video content, captions, or usernames, and never sends data off-device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ label, description, ok, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row justify-between items-center bg-surface border border-outlineVariant rounded-2xl p-4 mb-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${label} - ${ok ? "granted" : "not granted"}`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-text text-sm font-medium">{label}</Text>
        {description && (
          <Text className="text-textMuted text-xs mt-0.5">{description}</Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons
          name={ok ? "check-circle" : "alert-circle-outline"}
          size={22}
          color={ok ? "#10B981" : "#DC2626"}
        />
        <Text className={`text-xs font-semibold ${ok ? "text-success" : "text-error"}`}>
          {ok ? "Granted" : "Missing"}
        </Text>
      </View>
    </Pressable>
  );
}
