-- ScrollTracker SQLite Schema
-- All data stays on-device. No video content, captions, or usernames are ever stored.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- One row per supported short-form platform (seeded once)
CREATE TABLE IF NOT EXISTS platforms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT NOT NULL UNIQUE,       -- 'instagram_reels' | 'youtube_shorts' | 'tiktok' | 'snapchat_spotlight'
  display_name  TEXT NOT NULL,
  package_name  TEXT NOT NULL,              -- e.g. com.instagram.android
  color_hex     TEXT NOT NULL
);

-- One row per continuous foreground "session" a user spends inside a
-- short-form surface of a given app (bounded by app switch / screen off).
CREATE TABLE IF NOT EXISTS sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id       INTEGER NOT NULL REFERENCES platforms(id),
  started_at        INTEGER NOT NULL,       -- epoch millis
  ended_at          INTEGER,                 -- null while session is open
  duration_ms       INTEGER,                 -- filled on close
  video_count       INTEGER NOT NULL DEFAULT 0,  -- estimated videos viewed in this session
  source            TEXT NOT NULL DEFAULT 'accessibility', -- 'accessibility' | 'usage_stats_fallback'
  day_bucket        TEXT NOT NULL            -- 'YYYY-MM-DD' local date, for fast rollups
);

CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(day_bucket);
CREATE INDEX IF NOT EXISTS idx_sessions_platform_day ON sessions(platform_id, day_bucket);

-- Individual detected "video change" events within a session.
-- Kept lightweight (timestamp + confidence) - never any content.
CREATE TABLE IF NOT EXISTS video_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  occurred_at   INTEGER NOT NULL,
  confidence    REAL NOT NULL DEFAULT 1.0,   -- 0-1, heuristic certainty this was a distinct video
  detection     TEXT NOT NULL,               -- 'scroll_gesture' | 'view_id_change' | 'content_desc_change' | 'timer_heuristic' | 'swipe_direct'
  swipe_direction TEXT,                      -- 'UP' | 'DOWN' | NULL (null if no swipe detected)
  app_screen_state TEXT,                     -- 'VIDEO_FEED' | 'COMMENTS_OPEN' | 'PROFILE' | 'SEARCH' | 'UNKNOWN' | NULL
  detection_source TEXT DEFAULT 'heuristic'  -- 'swipe' | 'heuristic' (which method detected this)
);

CREATE INDEX IF NOT EXISTS idx_events_session ON video_events(session_id);

-- Precomputed daily rollups (refreshed after each session close) so the
-- Dashboard/Analytics screens never need to aggregate raw events at read time.
CREATE TABLE IF NOT EXISTS daily_stats (
  day_bucket        TEXT NOT NULL,
  platform_id       INTEGER NOT NULL REFERENCES platforms(id),
  total_videos      INTEGER NOT NULL DEFAULT 0,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  session_count     INTEGER NOT NULL DEFAULT 0,
  avg_watch_ms      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_bucket, platform_id)
);

-- User-defined daily goals per platform (or a combined "all platforms" goal, platform_id NULL)
CREATE TABLE IF NOT EXISTS goals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id       INTEGER REFERENCES platforms(id),  -- NULL = combined/global goal
  goal_type         TEXT NOT NULL,            -- 'video_count' | 'time_ms'
  limit_value       INTEGER NOT NULL,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        INTEGER NOT NULL
);

-- Streak tracking: one row per calendar day the user stayed within all active goals
CREATE TABLE IF NOT EXISTS streak_days (
  day_bucket    TEXT PRIMARY KEY,
  goals_met     INTEGER NOT NULL DEFAULT 0   -- 1 = all active goals respected that day
);

-- Focus Mode sessions (user-initiated blocking windows)
CREATE TABLE IF NOT EXISTS focus_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  planned_ms    INTEGER NOT NULL,
  interrupted   INTEGER NOT NULL DEFAULT 0
);

-- App-level key/value settings (theme, thresholds, onboarding completion, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key     TEXT PRIMARY KEY,
  value   TEXT NOT NULL
);

INSERT OR IGNORE INTO platforms (key, display_name, package_name, color_hex) VALUES
  ('instagram_reels', 'Instagram Reels', 'com.instagram.android', '#E1306C'),
  ('youtube_shorts',  'YouTube Shorts',  'com.google.android.youtube', '#FF0000'),
  ('tiktok',          'TikTok',          'com.zhiliaoapp.musically', '#25F4EE'),
  ('snapchat_spotlight', 'Snapchat Spotlight', 'com.snapchat.android', '#FFFC00');
