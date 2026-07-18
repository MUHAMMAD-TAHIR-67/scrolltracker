import * as SQLite from "expo-sqlite";

const DB_NAME = "scrolltracker.db";
let dbInstance = null;

/**
 * Singleton async DB accessor. expo-sqlite (SDK 52+) exposes an async API
 * backed by a native connection pool - safe to call from multiple places
 * without manually managing open/close.
 * @returns {Promise<SQLite.SQLiteDatabase>}
 */
export async function getDatabase() {
  if (dbInstance) return dbInstance;
  try {
    console.log("[v0] Opening database...");
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    if (!db) {
      console.error("[v0] Database initialization failed: SQLite.openDatabaseAsync returned null");
      // Return null gracefully instead of throwing
      return null;
    }
    console.log("[v0] Database opened successfully");
    
    dbInstance = db;
    await runMigrations(dbInstance);
    console.log("[v0] Database migrations completed");
    return dbInstance;
  } catch (error) {
    console.error("[v0] Database initialization failed:", error?.message || error);
    // Clear instance to allow retry on next call
    dbInstance = null;
    return null;
  }
}

const SCHEMA_VERSION = 2;

/** @param {SQLite.SQLiteDatabase} db */
async function runMigrations(db) {
  if (!db) return;
  
  try {
    await db.execAsync("PRAGMA foreign_keys = ON;");

    const row = await db.getFirstAsync("PRAGMA user_version;");
    const currentVersion = row?.user_version ?? 0;

    if (currentVersion < 1) {
      // Metro/Hermes can't import .sql files directly, so the bootstrap DDL
      // is inlined below (kept identical to src/db/schema.sql).
      await db.execAsync(BOOTSTRAP_SQL_V1);
      await db.execAsync(`PRAGMA user_version = 1;`);
      console.log("[v0] Database schema v1 created");
    }

    // Migration v1 -> v2: Add swipe detection columns to video_events
    if (currentVersion < 2) {
      await db.execAsync(MIGRATION_V2);
      await db.execAsync(`PRAGMA user_version = 2;`);
      console.log("[v0] Database schema v2 migrated (added swipe detection columns)");
    }

    // Run recovery on startup
    await recoverOrphanedSessions(db);
  } catch (error) {
    console.warn("[v0] Migration error (continuing anyway):", error?.message || error);
  }
}

/**
 * Recover orphaned sessions from crash/force-close.
 * Called on every app startup to ensure data integrity.
 * @param {SQLite.SQLiteDatabase} db
 */
async function recoverOrphanedSessions(db) {
  if (!db) return;
  try {
    // Use milliseconds (Date.now() format) for timestamp consistency
    // Sessions table stores timestamps in milliseconds, matching native layer (System.currentTimeMillis())
    const now = Date.now();
    const fiveMinutesAgoMs = now - (5 * 60 * 1000); // 5 minutes in milliseconds
    
    let orphanedResult;
    try {
      orphanedResult = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM sessions WHERE ended_at IS NULL AND started_at < ?`,
        [fiveMinutesAgoMs]
      );
    } catch (queryError) {
      console.warn("[v0] Failed to query orphaned sessions:", queryError?.message);
      return; // Skip recovery if query fails
    }
    
    if (orphanedResult && typeof orphanedResult.count === 'number' && orphanedResult.count > 0) {
      // Close orphaned sessions as terminated by crash
      // Use runAsync (not execAsync) for parameterized query support
      await db.runAsync(
        `UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL AND started_at < ?`,
        [now, fiveMinutesAgoMs]
      );
      console.log(`[v0] Recovered ${orphanedResult.count} orphaned sessions from previous crash`);
    }
  } catch (error) {
    console.warn("[v0] Recovery error (continuing anyway):", error?.message || error);
  }
}

// Migration from v1 to v2: Add swipe detection columns
// This backfills existing rows with 'heuristic' as the detection source for backward compatibility
const MIGRATION_V2 = `
ALTER TABLE video_events ADD COLUMN swipe_direction TEXT;
ALTER TABLE video_events ADD COLUMN app_screen_state TEXT;
ALTER TABLE video_events ADD COLUMN detection_source TEXT DEFAULT 'heuristic';
UPDATE video_events SET detection_source = 'heuristic' WHERE detection_source IS NULL;
`;

// Inlined copy of schema.sql (kept in sync manually, or generated at build
// time via a small script - see scripts/generate-schema-const.js).
const BOOTSTRAP_SQL_V1 = `
CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  color_hex TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER NOT NULL REFERENCES platforms(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER,
  video_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'accessibility',
  day_bucket TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(day_bucket);
CREATE INDEX IF NOT EXISTS idx_sessions_platform_day ON sessions(platform_id, day_bucket);
CREATE TABLE IF NOT EXISTS video_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  occurred_at INTEGER NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  detection TEXT NOT NULL,
  swipe_direction TEXT,
  app_screen_state TEXT,
  detection_source TEXT DEFAULT 'heuristic'
);
CREATE INDEX IF NOT EXISTS idx_events_session ON video_events(session_id);
CREATE TABLE IF NOT EXISTS daily_stats (
  day_bucket TEXT NOT NULL,
  platform_id INTEGER NOT NULL REFERENCES platforms(id),
  total_videos INTEGER NOT NULL DEFAULT 0,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  avg_watch_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_bucket, platform_id)
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER REFERENCES platforms(id),
  goal_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS streak_days (
  day_bucket TEXT PRIMARY KEY,
  goals_met INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  planned_ms INTEGER NOT NULL,
  interrupted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO platforms (key, display_name, package_name, color_hex) VALUES
  ('instagram_reels', 'Instagram Reels', 'com.instagram.android', '#E1306C'),
  ('youtube_shorts', 'YouTube Shorts', 'com.google.android.youtube', '#FF0000'),
  ('tiktok', 'TikTok', 'com.zhiliaoapp.musically', '#25F4EE'),
  ('snapchat_spotlight', 'Snapchat Spotlight', 'com.snapchat.android', '#FFFC00');
`;
