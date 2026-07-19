import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CartesianChart, Bar } from "victory-native";
import { getChartData, getPlatformBreakdown } from "@/features/analytics/utils/aggregations";
import { exportSessionsCsv } from "@/features/analytics/utils/csvExport";
import { StatCard } from "@/shared/components/StatCard";

export default function AnalyticsScreen() {
  const [range, setRange] = useState("week");
  const [chartData, setChartData] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (r) => {
    const [chart, plat] = await Promise.all([getChartData(r), getPlatformBreakdown(r)]);
    setChartData(chart);
    setBreakdown(plat);
  }, []);

  useEffect(() => {
    load(range);
  }, [range]);

  const totalVideos = breakdown.reduce((s, b) => s + b.totalVideos, 0);
  const topPlatform = breakdown.length > 0
    ? breakdown.reduce((best, b) => (b.totalVideos > best.totalVideos ? b : best), breakdown[0])
    : null;

  const onExport = async () => {
    setExporting(true);
    try {
      await exportSessionsCsv();
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="px-5 pt-2">
        {/* Header */}
        <View className="mb-5 mt-2">
          <Text className="text-text text-3xl font-bold mb-1">Analytics</Text>
          <Text className="text-textMuted text-sm">Your scrolling patterns over time</Text>
        </View>

        {/* Range selector */}
        <View className="bg-surface rounded-full p-1 mb-5 self-start flex-row gap-1 border border-outlineVariant">
          {[
            { key: "week", label: "7 Days" },
            { key: "month", label: "30 Days" },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setRange(option.key)}
              className={`px-5 py-2 rounded-full ${range === option.key ? "bg-primary" : ""}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: range === option.key }}
            >
              <Text
                className={`text-sm font-semibold ${
                  range === option.key ? "text-white" : "text-textMuted"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary stats — videos only */}
        <View className="flex-row gap-3 mb-5">
          <StatCard
            icon="eye-outline"
            label="Total Videos"
            value={String(totalVideos)}
            color="#10B981"
          />
          <StatCard
            icon="trophy-outline"
            label="Top Platform"
            value={topPlatform ? topPlatform.platform.displayName.split(" ")[0] : "—"}
            color="#059669"
          />
        </View>

        {/* Chart */}
        <View className="bg-surface border border-outlineVariant rounded-2xl p-4 mb-5">
          <View className="flex-row items-center gap-2 mb-4">
            <MaterialCommunityIcons name="chart-bar" size={20} color="#10B981" />
            <Text className="text-text text-base font-semibold">Videos per Day</Text>
          </View>
          <View style={{ height: 200 }}>
            {chartData.length > 0 ? (
              <CartesianChart
                data={chartData}
                xKey="day"
                yKeys={["totalVideos"]}
                domainPadding={{ left: 20, right: 20, top: 20 }}
                axisOptions={{ tickCount: 5, labelColor: "#6B7280" }}
              >
                {({ points, chartBounds }) => (
                  <Bar
                    points={points.totalVideos}
                    chartBounds={chartBounds}
                    color="#10B981"
                    roundedCorners={{ topLeft: 6, topRight: 6 }}
                  />
                )}
              </CartesianChart>
            ) : (
              <View className="flex-1 items-center justify-center">
                <MaterialCommunityIcons name="chart-bar-off" size={48} color="#A7F3D0" />
                <Text className="text-textMuted text-base mt-3">No data yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Platform breakdown */}
        <Text className="text-text text-lg font-semibold mb-3">By Platform</Text>
        {breakdown.map((item) => (
          <View
            key={item.platform.key}
            className="flex-row items-center justify-between bg-surface border border-outlineVariant rounded-2xl p-4 mb-3"
            accessibilityRole="summary"
            accessibilityLabel={`${item.platform.displayName}: ${item.totalVideos} videos`}
          >
            <View className="flex-row items-center gap-3">
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.platform.colorHex }}
                accessibilityHidden
              />
              <Text className="text-text text-base font-medium">{item.platform.displayName}</Text>
            </View>
            <View className="items-end">
              <Text className="text-primary text-base font-bold">{item.totalVideos} videos</Text>
              <Text className="text-textMuted text-xs">{item.percentOfTotal}% of total</Text>
            </View>
          </View>
        ))}

        {/* Export */}
        <Pressable
          onPress={onExport}
          disabled={exporting}
          className="bg-primary rounded-2xl py-4 px-6 flex-row items-center justify-center gap-3 mb-8 active:opacity-70"
          style={{ opacity: exporting ? 0.5 : 1 }}
          accessibilityRole="button"
          accessibilityLabel={exporting ? "Exporting data" : "Export as CSV"}
        >
          <MaterialCommunityIcons name="download-outline" size={22} color="#FFFFFF" />
          <Text className="text-white text-sm font-semibold">
            {exporting ? "Exporting..." : "Export as CSV"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
