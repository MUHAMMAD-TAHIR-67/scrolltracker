import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CartesianChart, Bar } from "victory-native";
import { getChartData, getPlatformBreakdown } from "@/features/analytics/utils/aggregations";
import { exportSessionsCsv } from "@/features/analytics/utils/csvExport";
import { Card } from "@/shared/components/Card";
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
  const totalMinutes = Math.round(breakdown.reduce((s, b) => s + b.totalDurationMs, 0) / 60_000);
  const avgWatchMs = totalVideos > 0
    ? Math.round(breakdown.reduce((s, b) => s + b.avgWatchMs * b.totalVideos, 0) / totalVideos)
    : 0;

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
        <View className="mb-6 mt-2">
          <Text className="text-text text-3xl font-bold mb-1">
            Analytics
          </Text>
          <Text className="text-textMuted text-base">
            Understand your usage patterns
          </Text>
        </View>

        {/* Time Range Selector */}
        <View className="bg-surface rounded-full p-1 mb-6 self-start flex-row gap-1">
          {[
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setRange(option.key)}
              className={`px-4 py-2 rounded-full ${
                range === option.key ? "bg-primary" : ""
              }`}
              accessibilityRole="tab"
              accessibilityState={{ selected: range === option.key }}
            >
              <Text 
                className={`${
                  range === option.key ? "text-white" : "text-textMuted"
                } text-sm font-medium capitalize`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary Stats Cards */}
        <View className="flex-row gap-3 mb-6">
          <StatCard 
            icon="eye-outline" 
            label="Total Videos" 
            value={String(totalVideos)} 
            color="#22C55E"
          />
          <StatCard 
            icon="clock-outline" 
            label="Time Spent" 
            value={`${totalMinutes}m`} 
            color="#6366F1"
          />
          <StatCard 
            icon="timer-outline" 
            label="Avg Watch" 
            value={`${Math.round(avgWatchMs / 1000)}s`} 
            color="#EF4444"
          />
        </View>

        {/* Chart Section */}
        <Card title="Videos per Day" icon="chart-bar" iconColor="#6366F1">
          <View style={{ height: 220 }}>
            {chartData.length > 0 ? (
              <CartesianChart
                data={chartData}
                xKey="day"
                yKeys={["totalVideos"]}
                domainPadding={{ left: 20, right: 20, top: 20 }}
                axisOptions={{ tickCount: 5, labelColor: "#94A3B8" }}
              >
                {({ points, chartBounds }) => (
                  <Bar
                    points={points.totalVideos}
                    chartBounds={chartBounds}
                    color="#6366F1"
                    roundedCorners={{ topLeft: 8, topRight: 8 }}
                  />
                )}
              </CartesianChart>
            ) : (
              <View className="flex-1 items-center justify-center">
                <MaterialCommunityIcons name="chart-bar-off" size={48} color="#475569" />
                <Text className="text-textMuted text-base mt-3">No data yet</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Platform Breakdown */}
        <View className="mb-6">
          <Text className="text-text text-lg font-semibold mb-4">
            By Platform
          </Text>
          {breakdown.map((item) => (
            <View
              key={item.platform.key}
              className="flex-row items-center justify-between bg-surface rounded-xl p-4 mb-3 border border-gray-700"
              accessibilityRole="summary"
              accessibilityLabel={`${item.platform.displayName}: ${item.totalVideos} videos, ${item.percentOfTotal}% of total`}
            >
              <View className="flex-row items-center gap-2">
                <View 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.platform.colorHex }}
                  accessibilityHidden={true}
                />
                <Text className="text-text text-base">
                  {item.platform.displayName}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-text text-base font-semibold">
                  {item.totalVideos} videos
                </Text>
                <Text className="text-textMuted text-xs">
                  {item.percentOfTotal}% of total
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Export Button */}
        <Pressable
          onPress={onExport}
          disabled={exporting}
          className="bg-primary rounded-xl py-4 px-6 flex-row items-center justify-center gap-3 mb-8 active:opacity-70 disabled:opacity-50"
          accessibilityRole="button"
          accessibilityLabel={exporting ? "Exporting data" : "Export analytics as CSV"}
        >
          <MaterialCommunityIcons name="download-outline" size={24} color="#FFFFFF" />
          <Text className="text-white text-sm font-semibold">
            {exporting ? "Exporting..." : "Export as CSV"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
