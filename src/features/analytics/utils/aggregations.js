import { format, subDays, eachDayOfInterval } from "date-fns";
import { trackingRepository } from "@/features/tracking/repository/TrackingRepository";

/**
 * @typedef {"week"|"month"} RangeKind
 *
 * @typedef {Object} ChartPoint
 * @property {string} day 'MM/dd'
 * @property {string} dayBucket 'yyyy-MM-dd'
 * @property {number} totalVideos
 * @property {number} totalDurationMin
 *
 * @typedef {Object} PlatformBreakdownItem
 * @property {import("@/features/tracking/types").Platform} platform
 * @property {number} totalVideos
 * @property {number} totalDurationMs
 * @property {number} avgWatchMs
 * @property {number} percentOfTotal
 */

/**
 * @param {RangeKind} range
 * @returns {Promise<ChartPoint[]>}
 */
export async function getChartData(range) {
  const days = range === "week" ? 7 : 30;
  const end = new Date();
  const start = subDays(end, days - 1);
  const startBucket = format(start, "yyyy-MM-dd");
  const endBucket = format(end, "yyyy-MM-dd");

  const stats = await trackingRepository.getStatsRange(startBucket, endBucket);
  const byDay = new Map();
  for (const s of stats) {
    const list = byDay.get(s.dayBucket) ?? [];
    list.push(s);
    byDay.set(s.dayBucket, list);
  }

  return eachDayOfInterval({ start, end }).map((date) => {
    const bucket = format(date, "yyyy-MM-dd");
    const dayStats = byDay.get(bucket) ?? [];
    const totalVideos = dayStats.reduce((sum, s) => sum + s.totalVideos, 0);
    const totalDurationMin = Math.round(dayStats.reduce((sum, s) => sum + s.totalDurationMs, 0) / 60_000);
    return { day: format(date, "MM/dd"), dayBucket: bucket, totalVideos, totalDurationMin };
  });
}

/**
 * @param {RangeKind} range
 * @returns {Promise<PlatformBreakdownItem[]>}
 */
export async function getPlatformBreakdown(range) {
  const days = range === "week" ? 7 : 30;
  const end = new Date();
  const start = subDays(end, days - 1);
  const stats = await trackingRepository.getStatsRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
  const platforms = await trackingRepository.getPlatforms();

  const totalsByPlatform = new Map();
  for (const s of stats) {
    const cur = totalsByPlatform.get(s.platformId) ?? { videos: 0, duration: 0 };
    cur.videos += s.totalVideos;
    cur.duration += s.totalDurationMs;
    totalsByPlatform.set(s.platformId, cur);
  }

  const grandTotal = Array.from(totalsByPlatform.values()).reduce((s, v) => s + v.videos, 0) || 1;

  return platforms.map((platform) => {
    const totals = totalsByPlatform.get(platform.id) ?? { videos: 0, duration: 0 };
    return {
      platform,
      totalVideos: totals.videos,
      totalDurationMs: totals.duration,
      avgWatchMs: totals.videos > 0 ? Math.round(totals.duration / totals.videos) : 0,
      percentOfTotal: Math.round((totals.videos / grandTotal) * 100),
    };
  });
}
