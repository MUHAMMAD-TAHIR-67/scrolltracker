# ScrollTracker - Setup & Documentation

## Overview
ScrollTracker is a production-ready Android app that monitors your short-form video consumption across Instagram Reels, TikTok, YouTube Shorts, and Snapchat Spotlight. It tracks videos watched only via vertical swipes (up/down) when the app is in focus and comments are not open.

## Key Features

### Core Tracking
- **Vertical Swipe Detection Only**: Only up/down swipes count videos. Horizontal swipes (left/right) are ignored
- **Comments-Aware**: Videos don't count when comments panel is open
- **Background Service**: Runs in background after one-time setup - no need to restart app
- **Database-Backed**: Persistent SQLite storage with transaction locking to prevent race conditions

### UI & Theme
- **Light Green & White Theme**: Clean, minimal design with green accent colors (#10B981)
- **Floating Counter**: Small green badge at bottom-right showing video count
- **Platform-Specific Stats**: Separate tracking for each platform

### Data Integrity
- **Transaction Serialization**: Database uses IMMEDIATE locks and transaction queuing to prevent double-counting
- **Duplicate Detection**: 500ms window prevents same video from being counted twice
- **Orphaned Session Recovery**: Automatic cleanup of incomplete sessions on app startup

## First-Time Setup (Important!)

### 1. Install the App
```bash
# Clone and install dependencies
npm install

# Build for Android
eas build --platform android --profile preview
```

### 2. Grant Required Permissions (One-Time Only!)
The app will guide you through permissions on first launch:
- **Accessibility Service**: Required for detecting swipes and scrolling
- **Usage Stats**: Fallback for detecting app launches
- **Battery Optimization**: To prevent OS killing the service

**Once granted, these permissions persist and the app works automatically in the background.**

### 3. Verify Setup
After onboarding:
- Dashboard shows "Tracking Active" with green checkmark
- Open any tracked app and start swiping - counter should update in real-time
- Check database is working by closing and reopening app - video count persists

## How It Works

### Detection Pipeline
1. **Native Layer** (Android Accessibility Service)
   - Monitors scroll events and detects swipe directions
   - Tracks app foreground/background state
   - Detects when comments panel opens

2. **JavaScript Layer**
   - Processes swipe events: validates direction (UP/DOWN only)
   - Filters out horizontal swipes, comment scrolls
   - Manages sessions and transaction atomicity

3. **Database Layer**
   - Stores sessions, video events, and daily stats
   - Prevents duplicates with deduplication window
   - Transaction-based to ensure consistency

### What Counts as a Video View
✅ **Counted**:
- Vertical swipe (up or down) in video feed
- Comments panel is closed
- User is actively on the platform

❌ **Not Counted**:
- Horizontal swipes (left/right)
- Any scrolling when comments panel is open
- Double-counting within 300ms
- Duplicate events within 500ms window

## Architecture

### Key Components

#### Services
- **TrackingService**: Main orchestrator, handles lifecycle and event processing
- **SessionEstimator**: Fallback heuristic detection if swipe detection fails
- **SwipeCounter**: Direct swipe-based counting (primary method)
- **CommentScrollDetector**: Identifies when comments panel is open

#### Database
- **Platform**: Stores Instagram, TikTok, YouTube, Snapchat metadata
- **Session**: Groups video events by app/day
- **VideoEvent**: Individual video views with detection method
- **DailyStat**: Aggregated stats per platform per day
- **Transaction Locking**: `BEGIN IMMEDIATE` prevents concurrent writes

#### UI
- **Dashboard**: Shows today's stats and platform breakdown
- **FloatingCounter**: Real-time counter overlay (updates optimistically)
- **Analytics**: Historical data and trends
- **Settings**: Goals, permissions management

### Background Persistence
Once setup is complete, the app:
1. Starts automatically when phone boots
2. Handles permission grants/revokes gracefully
3. Restarts service if OS kills process
4. Persists all data to SQLite
5. Requires no manual intervention

## Troubleshooting

### Videos Not Counting
1. **Check Status**: Dashboard should show "Tracking Active" with green checkmark
2. **Verify Accessibility**: Settings → Accessibility → ScrollTracker should be ON
3. **Close Comments**: Make sure comment panel is closed when swiping
4. **Use Vertical Swipes**: Only up/down swipes count (not left/right)
5. **Check Logs**: Run `adb logcat | grep v0` to see detailed debug logs

### Database Issues
1. **Data Inconsistent**: App recovers on next launch - orphaned sessions are auto-closed
2. **Duplicate Counts**: Deduplication window catches most cases; check timestamps in DB
3. **Slow Performance**: Database has optimized indexes; clear old data if needed

### Permissions Lost
If accessibility permission is revoked:
1. App detects missing permission automatically
2. Shows "Tracking Inactive" banner
3. Re-grant permission in Settings → Accessibility
4. Tracking resumes automatically

## Database Schema

```sql
platforms (id, key, display_name, package_name, color_hex)
  ↓
sessions (id, platform_id, started_at, ended_at, video_count, day_bucket)
  ↓
video_events (id, session_id, occurred_at, detection, swipe_direction, app_screen_state)
  ↓
daily_stats (day_bucket, platform_id, total_videos, total_duration_ms, session_count)
```

**Key Indexes**:
- `idx_sessions_platform_day_open`: Fast platform + day lookups for open sessions
- `idx_video_events_session_time`: Fast event queries by session
- `idx_daily_stats_range`: Optimized date range queries

## Production Ready Checklist

✅ **Stability**
- Transaction serialization prevents race conditions
- Duplicate event detection
- Orphaned session recovery
- Error circuit breaker (stops after 10 consecutive errors)

✅ **Accuracy**
- Vertical swipe only detection
- Comments-aware filtering
- 300ms debounce on repeated swipes
- 500ms duplicate window

✅ **Performance**
- Background service stays alive
- Optimized SQL queries with indexes
- Transaction batching
- Minimal battery impact

✅ **User Experience**
- One-time permission setup
- Works automatically in background
- Real-time floating counter
- Clear permission status

## Deployment

### Release Build
```bash
# Build production APK
eas build --platform android --profile production

# Or AAB for Play Store
eas build --platform android --profile production --output app.aab
```

### Environment
The app requires **no** environment variables or external services. All data is stored locally in SQLite.

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review app logs: `adb logcat | grep v0`
3. Inspect database: `adb shell sqlite3 /data/data/com.anonymous.scrolltracker/databases/scrolltracker.db`
4. Verify permissions in system settings

---

**Version**: 1.0.0 (Production Ready)
**Theme**: Light Green & White
**Database**: SQLite with transaction locking
**Tracking**: Vertical swipes only, background service
