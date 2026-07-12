import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="px-5 pt-2">
        <Text className="text-white text-2xl font-bold mb-4 mt-2">Analytics</Text>

        <View className="flex-row bg-surface rounded-full p-1 mb-5 self-start">
          {["week", "month"].map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              className={`px-4 py-2 rounded-full ${range === r ? "bg-primary" : ""}`}
            >
              <Text className="text-white text-sm capitalize">{r}</Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-3 mb-5">
          <SummaryStat label="Total videos" value={String(totalVideos)} />
          <SummaryStat label="Time spent" value={`${totalMinutes}m`} />
          <SummaryStat label="Avg watch" value={`${Math.round(avgWatchMs / 1000)}s`} />
        </View>

        <Text className="text-white font-semibold mb-2">Videos per day</Text>
        <View style={{ height: 220 }} className="mb-6 bg-surface rounded-2xl p-3">
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
                  roundedCorners={{ topLeft: 4, topRight: 4 }}
                />
              )}
            </CartesianChart>
          ) : (
            <Text className="text-muted text-center mt-16">No data yet</Text>
          )}
        </View>

        <Text className="text-white font-semibold mb-2">By platform</Text>
        {breakdown.map((item) => (
          <View
            key={item.platform.key}
            className="flex-row items-center justify-between bg-surface rounded-2xl p-4 mb-3 border border-surfaceAlt"
          >
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.platform.colorHex }} />
              <Text className="text-white">{item.platform.displayName}</Text>
            </View>
            <View className="items-end">
              <Text className="text-white font-semibold">{item.totalVideos} videos</Text>
              <Text className="text-muted text-xs">{item.percentOfTotal}% of total</Text>
            </View>
          </View>
        ))}

        <Pressable
          onPress={onExport}
          disabled={exporting}
          className="bg-surfaceAlt rounded-2xl py-4 items-center my-6"
        >
          <Text className="text-white font-semibold">
            {exporting ? "Exporting..." : "Export statistics as CSV"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {{label: string, value: string}} props */
function SummaryStat({ label, value }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-3 border border-surfaceAlt">
      <Text className="text-white text-xl font-bold">{value}</Text>
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}
