import { getDatabase, withTransaction } from "@/db/database";
import { format } from "date-fns";

/**
 * Single point of access to tracking data. UI and stores never write raw SQL -
 * they call through here. Keeps SQL centralized and swappable (e.g. if we
 * later move to op-sqlite or a sync backend).
 */
export class TrackingRepository {
  /** @returns {Promise<import("../types").Platform[]>} */
  async getPlatforms() {
    const db = await getDatabase();
    const rows = await db.getAllAsync("SELECT * FROM platforms ORDER BY id;");
    return rows.map(mapPlatform);
  }

  /** @returns {Promise<import("../types").Platform|null>} */
  async getPlatformByKey(key) {
    const db = await getDatabase();
    const row = await db.getFirstAsync("SELECT * FROM platforms WHERE key = ?;", [key]);
    return row ? mapPlatform(row) : null;
  }

  /**
   * @param {number} platformId
   * @param {number} startedAt
   * @param {import("../types").SessionSource} source
   * @returns {Promise<number>} the new session id
   */
  async openSession(platformId, startedAt, source) {
    const db = await getDatabase();
    const dayBucket = format(startedAt, "yyyy-MM-dd");
    
    return await withTransaction(db, async (txDb) => {
      // Check if an active session already exists for this platform today
      // Prevents duplicate sessions from concurrent calls
      const existing = await txDb.getFirstAsync(
        `SELECT id FROM sessions WHERE platform_id = ? AND day_bucket = ? AND ended_at IS NULL LIMIT 1;`,
        [platformId, dayBucket]
      );
      
      if (existing) {
        console.log("[v0] Session already exists for platform, reusing existing:", existing.id);
        return existing.id;
      }
      
      // Create new session
      const result = await txDb.runAsync(
        `INSERT INTO sessions (platform_id, started_at, video_count, source, day_bucket)
         VALUES (?, ?, 0, ?, ?);`,
        [platformId, startedAt, source, dayBucket]
      );
      return result.lastInsertRowId;
    });
  }

  /**
   * Append a video event (detected video change) to a session.
   * Uses transaction to ensure atomicity. Prevents duplicate events within 1 second window.
   * @param {number} sessionId
   * @param {number} occurredAt
   * @param {number} confidence
   * @param {string} detection - detection method ('swipe_direct', 'view_id_change', etc.)
   * @param {Object} [options] - optional: { swipeDirection, appScreenState, detectionSource }
   */
  async appendVideoEvent(sessionId, occurredAt, confidence, detection, options = {}) {
    const db = await getDatabase();
    const { swipeDirection = null, appScreenState = null, detectionSource = 'heuristic' } = options;
    
    return await withTransaction(db, async (txDb) => {
      // Check for duplicate: same session, within 1 second window
      // Prevents double-counting from concurrent event processing
      const recent = await txDb.getFirstAsync(
        `SELECT id FROM video_events WHERE session_id = ? AND occurred_at >= ? LIMIT 1;`,
        [sessionId, occurredAt - 1000]
      );
      
      if (recent) {
        console.log("[v0] Duplicate video event detected, skipping:", sessionId, occurredAt);
        return recent.id; // Return existing event ID
      }
      
      // Insert new event
      const result = await txDb.runAsync(
        `INSERT INTO video_events (session_id, occurred_at, confidence, detection, swipe_direction, app_screen_state, detection_source)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [sessionId, occurredAt, confidence, detection, swipeDirection, appScreenState, detectionSource]
      );
      
      // Increment video count for session (atomic with event insert)
      await txDb.runAsync(`UPDATE sessions SET video_count = video_count + 1 WHERE id = ?;`, [sessionId]);
      
      return result.lastInsertRowId;
    });
  }

  async closeSession(sessionId, endedAt) {
    const db = await getDatabase();
    
    return await withTransaction(db, async (txDb) => {
      const session = await txDb.getFirstAsync("SELECT * FROM sessions WHERE id = ?;", [sessionId]);
      if (!session) return;
      
      const durationMs = endedAt - session.started_at;
      
      // Update session with end time (atomic)
      await txDb.runAsync(
        `UPDATE sessions SET ended_at = ?, duration_ms = ? WHERE id = ?;`,
        [endedAt, durationMs, sessionId]
      );
      
      // Recompute daily stats within same transaction
      await this._recomputeDailyStatTx(txDb, session.platform_id, session.day_bucket);
    });
  }

  /** Recomputes the daily_stats rollup row for a platform/day from raw sessions. */
  async recomputeDailyStat(platformId, dayBucket) {
    const db = await getDatabase();
    return await withTransaction(db, async (txDb) => {
      return await this._recomputeDailyStatTx(txDb, platformId, dayBucket);
    });
  }

  /** Internal: recompute daily stat within a transaction. */
  async _recomputeDailyStatTx(txDb, platformId, dayBucket) {
    const agg = await txDb.getFirstAsync(
      `SELECT
         COALESCE(SUM(video_count), 0) as total_videos,
         COALESCE(SUM(duration_ms), 0) as total_duration_ms,
         COUNT(*) as session_count
       FROM sessions
       WHERE platform_id = ? AND day_bucket = ? AND ended_at IS NOT NULL;`,
      [platformId, dayBucket]
    );
    const avgWatchMs = agg.total_videos > 0 ? Math.round(agg.total_duration_ms / agg.total_videos) : 0;
    await txDb.runAsync(
      `INSERT INTO daily_stats (day_bucket, platform_id, total_videos, total_duration_ms, session_count, avg_watch_ms)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(day_bucket, platform_id) DO UPDATE SET
         total_videos = excluded.total_videos,
         total_duration_ms = excluded.total_duration_ms,
         session_count = excluded.session_count,
         avg_watch_ms = excluded.avg_watch_ms;`,
      [dayBucket, platformId, agg.total_videos, agg.total_duration_ms, agg.session_count, avgWatchMs]
    );
  }

  /** @returns {Promise<import("../types").DailyStat[]>} */
  async getDailyStats(dayBucket) {
    const db = await getDatabase();
    const rows = await db.getAllAsync(`SELECT * FROM daily_stats WHERE day_bucket = ?;`, [dayBucket]);
    return rows.map(mapDailyStat);
  }

  /** @returns {Promise<import("../types").DailyStat[]>} */
  async getStatsRange(startDay, endDay) {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM daily_stats WHERE day_bucket BETWEEN ? AND ? ORDER BY day_bucket ASC;`,
      [startDay, endDay]
    );
    return rows.map(mapDailyStat);
  }

  /** @returns {Promise<import("../types").Goal[]>} */
  async getActiveGoals() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(`SELECT * FROM goals WHERE is_active = 1;`);
    return rows.map(mapGoal);
  }

  /** @param {Omit<import("../types").Goal, "id"|"createdAt">} goal */
  async upsertGoal(goal) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO goals (platform_id, goal_type, limit_value, is_active, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [goal.platformId, goal.goalType, goal.limitValue, goal.isActive ? 1 : 0, Date.now()]
    );
  }

  async recordStreakDay(dayBucket, goalsMet) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO streak_days (day_bucket, goals_met) VALUES (?, ?)
       ON CONFLICT(day_bucket) DO UPDATE SET goals_met = excluded.goals_met;`,
      [dayBucket, goalsMet ? 1 : 0]
    );
  }

  /** @returns {Promise<number>} */
  async getCurrentStreak() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(`SELECT * FROM streak_days ORDER BY day_bucket DESC LIMIT 90;`);
    let streak = 0;
    for (const row of rows) {
      if (row.goals_met === 1) streak += 1;
      else break;
    }
    return streak;
  }

  /** @returns {Promise<Record<string, string|number>[]>} */
  async exportAllSessionsAsRows() {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT s.day_bucket, p.display_name as platform, s.started_at, s.ended_at,
              s.duration_ms, s.video_count, s.source
       FROM sessions s JOIN platforms p ON p.id = s.platform_id
       WHERE s.ended_at IS NOT NULL
       ORDER BY s.started_at ASC;`
    );
  }

  /**
   * Optimized batch fetch: get all data needed for dashboard in one query.
   * Reduces number of round-trips to database.
   * @param {string} dayBucket
   * @returns {Promise<{platforms: any[], dailyStats: any[], goals: any[]}>}
   */
  async getDashboardData(dayBucket) {
    const db = await getDatabase();
    
    // All three queries run in parallel for better performance
    const [platforms, dailyStats, goals] = await Promise.all([
      db.getAllAsync("SELECT * FROM platforms ORDER BY id;"),
      db.getAllAsync(`SELECT * FROM daily_stats WHERE day_bucket = ?;`, [dayBucket]),
      db.getAllAsync(`SELECT * FROM goals WHERE is_active = 1;`)
    ]);
    
    return {
      platforms: platforms.map(mapPlatform),
      dailyStats: dailyStats.map(mapDailyStat),
      goals: goals.map(mapGoal)
    };
  }

  /**
   * Optimized batch fetch: get all analytics data for a date range.
   * @param {string} startDay
   * @param {string} endDay
   * @returns {Promise<{statsRange: any[], breakdown: any[]}>}
   */
  async getAnalyticsData(startDay, endDay) {
    const db = await getDatabase();
    
    // Fetch stats and compute breakdown in parallel
    const [statsRange, breakdown] = await Promise.all([
      db.getAllAsync(
        `SELECT * FROM daily_stats WHERE day_bucket BETWEEN ? AND ? ORDER BY day_bucket ASC;`,
        [startDay, endDay]
      ),
      db.getAllAsync(
        `SELECT 
          p.id, p.key, p.display_name, p.color_hex,
          COALESCE(SUM(s.video_count), 0) as total_videos,
          COALESCE(SUM(s.duration_ms), 0) as total_duration_ms,
          COALESCE(AVG(s.duration_ms / NULLIF(s.video_count, 0)), 0) as avg_watch_ms
         FROM platforms p
         LEFT JOIN sessions s ON p.id = s.platform_id AND s.day_bucket BETWEEN ? AND ? AND s.ended_at IS NOT NULL
         GROUP BY p.id
         ORDER BY p.id;`,
        [startDay, endDay]
      )
    ]);
    
    return {
      statsRange: statsRange.map(mapDailyStat),
      breakdown: breakdown.map(row => ({
        platform: mapPlatform(row),
        totalVideos: row.total_videos,
        totalDurationMs: row.total_duration_ms,
        avgWatchMs: row.avg_watch_ms,
        percentOfTotal: 0 // Calculated in service layer
      }))
    };
  }
}

function mapPlatform(row) {
  return {
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    packageName: row.package_name,
    colorHex: row.color_hex,
  };
}

function mapDailyStat(row) {
  return {
    dayBucket: row.day_bucket,
    platformId: row.platform_id,
    totalVideos: row.total_videos,
    totalDurationMs: row.total_duration_ms,
    sessionCount: row.session_count,
    avgWatchMs: row.avg_watch_ms,
  };
}

function mapGoal(row) {
  return {
    id: row.id,
    platformId: row.platform_id,
    goalType: row.goal_type,
    limitValue: row.limit_value,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

export const trackingRepository = new TrackingRepository();
