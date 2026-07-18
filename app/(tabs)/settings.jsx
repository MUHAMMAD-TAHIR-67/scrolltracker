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
      <ScrollView className="px-6 pt-2">
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-onBackground text-headline-large font-normal mb-1">Settings</Text>
          <Text className="text-onSurfaceVariant text-body-medium">Manage permissions and preferences</Text>
        </View>

        {/* Permissions Section */}
        <View className="mb-6">
          <Text className="text-onSurfaceVariant text-title-small font-medium uppercase mb-3 tracking-wide">Permissions</Text>
          
          <StatusRow
            label="Accessibility Service"
            description="Detects scrolling and video changes"
            ok={permissions.accessibilityGranted}
            onPress={permissions.openAccessibilitySettings}
          />
          <StatusRow
            label="Usage Access"
            description="Measures time spent per app"
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
            className="bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Open autostart settings for Xiaomi, Vivo, Oppo, or Huawei devices"
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="power-plug-outline" size={24} color="#D0BCFF" />
              <View className="flex-1">
                <Text className="text-onSurface text-body-large">Xiaomi / Vivo / Oppo / Huawei</Text>
                <Text className="text-onSurfaceVariant text-body-small mt-0.5">
                  Enable autostart if tracking stops in background
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#938F99" />
            </View>
          </Pressable>
        </View>

        {/* Notifications Section */}
        <View className="mb-6">
          <Text className="text-onSurfaceVariant text-title-small font-medium uppercase mb-3 tracking-wide">Notifications</Text>
          
          <View className="bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant">
            <View className="flex-row justify-between items-center mb-1">
              <View className="flex-1">
                <Text className="text-onSurface text-body-large">Daily Limit Alerts</Text>
                <Text className="text-onSurfaceVariant text-body-small mt-0.5">
                  Get notified when you reach your daily goal
                </Text>
              </View>
              <Switch
                value={settings.dailyLimitNotificationsEnabled}
                onValueChange={settings.toggleDailyLimitNotifications}
                trackColor={{ false: "#49454F", true: "#D0BCFF" }}
                thumbColor={settings.dailyLimitNotificationsEnabled ? "#381E72" : "#CAC4D0"}
              />
            </View>
          </View>

          <View className="bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-1">
                <Text className="text-onSurface text-body-large">Excessive Scrolling Alerts</Text>
                <Text className="text-onSurfaceVariant text-body-small mt-0.5">
                  Alert after continuous scrolling for:
                </Text>
              </View>
              <Switch
                value={settings.excessiveScrollNotificationsEnabled}
                onValueChange={settings.toggleExcessiveScrollNotifications}
                trackColor={{ false: "#49454F", true: "#D0BCFF" }}
                thumbColor={settings.excessiveScrollNotificationsEnabled ? "#381E72" : "#CAC4D0"}
              />
            </View>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {THRESHOLD_OPTIONS.map((min) => (
                <Pressable
                  key={min}
                  onPress={() => settings.setExcessiveScrollThreshold(min)}
                  className={`px-4 py-2 rounded-full ${
                    settings.excessiveScrollThresholdMin === min 
                      ? "bg-primaryContainer" 
                      : "bg-surfaceContainerHigh"
                  }`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: settings.excessiveScrollThresholdMin === min }}
                >
                  <Text className={`${
                    settings.excessiveScrollThresholdMin === min 
                      ? "text-onPrimaryContainer" 
                      : "text-onSurfaceVariant"
                  } text-label-large font-medium`}>
                    {min}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Data Section */}
        <View className="mb-6">
          <Text className="text-onSurfaceVariant text-title-small font-medium uppercase mb-3 tracking-wide">Data</Text>
          
          <Pressable
            onPress={() => exportSessionsCsv()}
            className="bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant flex-row items-center gap-3 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Export statistics as CSV file"
          >
            <MaterialCommunityIcons name="file-export-outline" size={24} color="#80DEEA" />
            <Text className="text-onSurface text-body-large flex-1">Export statistics as CSV</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#938F99" />
          </Pressable>
        </View>

        {/* Privacy Section */}
        <View className="bg-surfaceContainerHigh rounded-2xl p-5 mb-8 border border-outlineVariant">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="shield-check-outline" size={24} color="#81C995" style={{ marginRight: 8 }} />
            <Text className="text-onSurface text-title-medium font-medium">Your Privacy</Text>
          </View>
          <Text className="text-onSurfaceVariant text-body-small leading-6">
            All tracking data lives only in this app's local SQLite database.
            ScrollTracker never reads video content, captions, or usernames,
            and never sends data off-device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {{label: string, description?: string, ok: boolean, onPress: () => void}} props */
function StatusRow({ label, description, ok, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row justify-between items-center bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${label} - ${ok ? "granted" : "not granted"}`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-onSurface text-body-large">{label}</Text>
        {description && (
          <Text className="text-onSurfaceVariant text-body-small mt-0.5">{description}</Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons
          name={ok ? "check-circle" : "alert-circle-outline"}
          size={24}
          color={ok ? "#81C995" : "#F2B8B5"}
        />
        <Text className={`${ok ? "text-success" : "text-error"} text-label-large font-medium`}>
          {ok ? "Granted" : "Missing"}
        </Text>
      </View>
    </Pressable>
  );
}