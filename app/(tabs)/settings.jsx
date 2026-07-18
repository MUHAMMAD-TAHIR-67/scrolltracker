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
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="px-5 pt-2">
        <Text className="text-white text-2xl font-bold mb-5 mt-2">Settings</Text>

        <SectionTitle title="Permissions" />
        <StatusRow
          label="Accessibility Service"
          ok={permissions.accessibilityGranted}
          onPress={permissions.openAccessibilitySettings}
        />
        <StatusRow
          label="Usage Access"
          ok={permissions.usageAccessGranted}
          onPress={permissions.openUsageAccessSettings}
        />
        <StatusRow
          label="Notifications"
          ok={permissions.notificationsGranted}
          onPress={permissions.requestNotifications}
        />
        <StatusRow
          label="Background battery access"
          ok={permissions.batteryOptimizationIgnored}
          onPress={permissions.requestBatteryOptimizationExemption}
        />
        <Pressable
          onPress={permissions.openAutostartSettings}
          className="bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt"
        >
          <Text className="text-white">Xiaomi / Vivo / Oppo / Huawei autostart</Text>
          <Text className="text-muted text-xs mt-0.5">
            Tap if tracking keeps stopping in the background on these brands
          </Text>
        </Pressable>

        <SectionTitle title="Alerts" />
        <View className="bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-white">Daily limit notifications</Text>
            <Switch
              value={settings.dailyLimitNotificationsEnabled}
              onValueChange={settings.toggleDailyLimitNotifications}
              trackColor={{ true: "#6366F1" }}
            />
          </View>
          <Text className="text-muted text-xs">
            Get notified when you reach a goal you set on the Goals tab.
          </Text>
        </View>

        <View className="bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-white">Excessive scrolling alerts</Text>
            <Switch
              value={settings.excessiveScrollNotificationsEnabled}
              onValueChange={settings.toggleExcessiveScrollNotifications}
              trackColor={{ true: "#6366F1" }}
            />
          </View>
          <Text className="text-muted text-xs mb-3">
            Alert after continuous scrolling for:
          </Text>
          <View className="flex-row gap-2">
            {THRESHOLD_OPTIONS.map((min) => (
              <Pressable
                key={min}
                onPress={() => settings.setExcessiveScrollThreshold(min)}
                className={`px-3 py-2 rounded-xl ${
                  settings.excessiveScrollThresholdMin === min ? "bg-primary" : "bg-surfaceAlt"
                }`}
              >
                <Text className="text-white text-xs">{min}m</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <SectionTitle title="Data" />
        <Pressable
          onPress={() => exportSessionsCsv()}
          className="bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt"
        >
          <Text className="text-white">Export statistics as CSV</Text>
        </Pressable>

        <View className="bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt">
          <Text className="text-white mb-1">Your privacy</Text>
          <Text className="text-muted text-xs leading-5">
            All tracking data lives only in this app's local SQLite database.
            ScrollTracker never reads video content, captions, or usernames,
            and never sends data off-device.
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {{title: string}} props */
function SectionTitle({ title }) {
  return <Text className="text-muted text-xs font-semibold uppercase mb-2 mt-2">{title}</Text>;
}

/** @param {{label: string, ok: boolean, onPress: () => void}} props */
function StatusRow({ label, ok, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row justify-between items-center bg-surface rounded-lg p-4 mb-3 border border-surfaceAlt active:opacity-80"
    >
      <Text className="text-white">{label}</Text>
      <View className="flex-row items-center gap-1">
        <MaterialCommunityIcons
          name={ok ? "check-circle" : "alert-circle"}
          size={16}
          color={ok ? "#10B981" : "#EF4444"}
        />
        <Text className={ok ? "text-success" : "text-danger"}>{ok ? "Granted" : "Missing"}</Text>
      </View>
    </Pressable>
  );
}