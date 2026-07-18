import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CartesianChart, Bar } from "victory-native";
import { getChartData, getPlatformBreakdown } from "@/features/analytics/utils/aggregations";
import { exportSessionsCsv } from "@/features/analytics/utils/csvExport";

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
      <ScrollView className="px-6 pt-2">
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-onBackground text-headline-large font-normal mb-1">Analytics</Text>
          <Text className="text-onSurfaceVariant text-body-medium">Understand your usage patterns</Text>
        </View>

        {/* Time Range Selector */}
        <View className="bg-surfaceContainer rounded-full p-1 mb-6 self-start flex-row gap-1">
          {[
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setRange(option.key)}
              className={`px-5 py-2.5 rounded-full ${range === option.key ? "bg-primaryContainer" : ""}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: range === option.key }}
            >
              <Text className={`${range === option.key ? "text-onPrimaryContainer" : "text-onSurfaceVariant"} text-label-large font-medium capitalize`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary Stats Cards */}
        <View className="flex-row gap-3 mb-6">
          <SummaryStat 
            icon="eye-outline" 
            label="Total Videos" 
            value={String(totalVideos)} 
            color="#80DEEA"
          />
          <SummaryStat 
            icon="clock-outline" 
            label="Time Spent" 
            value={`${totalMinutes}m`} 
            color="#D0BCFF"
          />
          <SummaryStat 
            icon="timer-outline" 
            label="Avg Watch" 
            value={`${Math.round(avgWatchMs / 1000)}s`} 
            color="#EFB8C8"
          />
        </View>

        {/* Chart Section */}
        <View className="bg-surfaceContainerHigh rounded-3xl p-5 mb-6">
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons name="chart-bar" size={20} color="#D0BCFF" style={{ marginRight: 8 }} />
            <Text className="text-onSurfaceVariant text-title-small font-medium">Videos per Day</Text>
          </View>
          <View style={{ height: 220 }}>
            {chartData.length > 0 ? (
              <CartesianChart
                data={chartData}
                xKey="day"
                yKeys={["totalVideos"]}
                domainPadding={{ left: 20, right: 20, top: 20 }}
                axisOptions={{ tickCount: 5, labelColor: "#938F99" }}
              >
                {({ points, chartBounds }) => (
                  <Bar
                    points={points.totalVideos}
                    chartBounds={chartBounds}
                    color="#D0BCFF"
                    roundedCorners={{ topLeft: 8, topRight: 8 }}
                  />
                )}
              </CartesianChart>
            ) : (
              <View className="flex-1 items-center justify-center">
                <MaterialCommunityIcons name="chart-bar-off" size={48} color="#49454F" />
                <Text className="text-onSurfaceVariant text-body-medium mt-3">No data yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Platform Breakdown */}
        <View className="mb-6">
          <Text className="text-onSurfaceVariant text-title-medium font-medium mb-4">By Platform</Text>
          {breakdown.map((item) => (
            <View
              key={item.platform.key}
              className="flex-row items-center justify-between bg-surfaceContainer rounded-2xl p-4 mb-3 border border-outlineVariant"
            >
              <View className="flex-row items-center gap-3">
                <View 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: item.platform.colorHex }} 
                />
                <Text className="text-onSurface text-body-large">{item.platform.displayName}</Text>
              </View>
              <View className="items-end">
                <Text className="text-onSurface text-title-medium font-medium">{item.totalVideos} videos</Text>
                <Text className="text-onSurfaceVariant text-label-small">{item.percentOfTotal}% of total</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Export Button */}
        <Pressable
          onPress={onExport}
          disabled={exporting}
          className="bg-primaryContainer rounded-2xl py-4 px-6 flex-row items-center justify-center gap-3 mb-8 active:opacity-70 disabled:opacity-50"
          accessibilityRole="button"
          accessibilityLabel={exporting ? "Exporting data" : "Export analytics as CSV"}
        >
          <MaterialCommunityIcons name="download-outline" size={24} color="#381E72" />
          <Text className="text-onPrimaryContainer text-label-large font-medium">
            {exporting ? "Exporting..." : "Export as CSV"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {{icon: string, label: string, value: string, color: string}} props */
function SummaryStat({ icon, label, value, color }) {
  return (
    <View className="flex-1 bg-surfaceContainerHigh rounded-2xl p-4 border border-outlineVariant">
      <MaterialCommunityIcons name={icon} size={24} color={color} style={{ marginBottom: 8 }} />
      <Text className="text-onSurface text-headline-small font-light">{value}</Text>
      <Text className="text-onSurfaceVariant text-label-small mt-1">{label}</Text>
    </View>
  );
}
