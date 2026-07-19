import * as SQLite from "expo-sqlite";

const DB_NAME = "scrolltracker.db";
let dbInstance = null;

// Serializes all writes so they never run concurrently.
// expo-sqlite v16 has its own connection pool; running overlapping
// BEGIN...COMMIT blocks from JS still causes "cannot start a transaction
// within a transaction" errors. This queue prevents that entirely.
let writeQueue = Promise.resolve();

/**
 * Serialize a write operation so it never overlaps with another write.
 * @param {SQLite.SQLiteDatabase} db
 * @param {(db: SQLite.SQLiteDatabase) => Promise<any>} callback
 * @returns {Promise<any>}
 */
export function withTransaction(db, callback) {
  if (!db) return Promise.reject(new Error("Database not available"));

  const work = () =>
    db.withTransactionAsync(async () => {
      return await callback(db);
    });

  // Chain on the queue so writes run one at a time
  const next = writeQueue.then(work, work);
  writeQueue = next.catch(() => {}); // prevent queue from dying on error
  return next;
}

/**
 * Singleton DB accessor.
 * @returns {Promise<SQLite.SQLiteDatabase>}
 */
export async function getDatabase() {
  if (dbInstance) return dbInstance;
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    if (!db) return null;
    dbInstance = db;
    await runMigrations(dbInstance);
    return dbInstance;
  } catch (error) {
    dbInstance = null;
    return null;
  }
}

const SCHEMA_VERSION = 3;

async function runMigrations(db) {
  if (!db) return;
  try {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    const row = await db.getFirstAsync("PRAGMA user_version;");
    const currentVersion = row?.user_version ?? 0;

    if (currentVersion < 1) {
      await db.execAsync(BOOTSTRAP_SQL_V1);
      await db.execAsync("PRAGMA user_version = 1;");
    }
    if (currentVersion < 2) {
      await db.execAsync(MIGRATION_V2);
      await db.execAsync("PRAGMA user_version = 2;");
    }
    if (currentVersion < 3) {
      await db.execAsync(MIGRATION_V3);
      await db.execAsync("PRAGMA user_version = 3;");
    }

    await recoverOrphanedSessions(db);
  } catch (error) {
    // Non-fatal — app still works, just with a partial schema
  }
}

async function recoverOrphanedSessions(db) {
  if (!db) return;
  try {
    const now = Date.now();
    const cutoff = now - 5 * 60 * 1000; // 5 minutes ago
    const result = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM sessions WHERE ended_at IS NULL AND started_at < ?",
      [cutoff]
    );
    if (result?.count > 0) {
      await db.runAsync(
        "UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL AND started_at < ?",
        [now, cutoff]
      );
    }
  } catch (_) {
    // Non-fatal
  }
}

const MIGRATION_V2 = `
ALTER TABLE video_events ADD COLUMN swipe_direction TEXT;
ALTER TABLE video_events ADD COLUMN app_screen_state TEXT;
ALTER TABLE video_events ADD COLUMN detection_source TEXT DEFAULT 'heuristic';
`;

const MIGRATION_V3 = `
CREATE INDEX IF NOT EXISTS idx_sessions_platform_day_open ON sessions(platform_id, day_bucket, ended_at);
CREATE INDEX IF NOT EXISTS idx_video_events_session_time ON video_events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_daily_stats_day ON daily_stats(day_bucket);
CREATE INDEX IF NOT EXISTS idx_daily_stats_platform ON daily_stats(platform_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_range ON daily_stats(day_bucket, platform_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_streak_days_unique ON streak_days(day_bucket);
ANALYZE;
`;

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
