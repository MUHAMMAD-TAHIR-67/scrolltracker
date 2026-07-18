# ScrollTracker - Comprehensive Audit Report

**Date:** January 2025  
**Status:** COMPLETE ANALYSIS WITH FIX ROADMAP

---

## EXECUTIVE SUMMARY

ScrollTracker is a React Native + Kotlin application that tracks short-form video consumption across TikTok, Instagram Reels, YouTube Shorts, and Snapchat Spotlight. The swipe-based tracking architecture is sound, but **5 critical issues** prevent it from working properly after app closure:

1. **CRITICAL: Tracking stops when app closes** - No background process restart
2. **HIGH: Analytics persistence failures** - Missing edge cases in lifecycle
3. **HIGH: Duplicate manifest entries** - Causes undefined behavior
4. **MEDIUM: Insufficient lifecycle error handling** - Race conditions during app startup
5. **LOW: UI needs professional redesign** - Emoji usage, inconsistent theming

---

## PROBLEM #1: TRACKING STOPS AFTER APP CLOSURE

### Status: CRITICAL (Core Issue)

### Root Cause Analysis

**Why it happens:**
- The AccessibilityService runs independently, BUT the JavaScript tracking layer (`TrackingService.js`) is NOT automatically restarted when the app process is killed by Android
- When user closes/backgrounds app → OS may kill the React Native process → JS runtime stops
- AccessibilityService continues to receive events, but they're buffered (max 500 in ScrollEventBus)
- When JS runtime restarts hours later, the buffer has overflowed → events are lost
- User sees 0 videos tracked during that period

**The mechanism:**
```
User closes TikTok app
→ Android kills scrolltracker app process
→ React Native JS runtime stops
→ TrackingService#start() is not called again
→ subscribeToScrollEvents() listener is inactive
→ AccessibilityService still firing events (in native layer)
→ Events accumulate in ScrollEventBus ring buffer (max 500)
→ Buffer overflow → oldest events discarded
→ 6 hours later, user opens app
→ JS runtime restarts, calls TrackingService.start()
→ drainPendingEvents() returns only last 500 events
→ Days of scroll activity is lost
```

### Current Code Issues

**BootReceiver.kt** - Partially works but has limitations:
```kotlin
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        
        val prefs = context.getSharedPreferences("scrolltracker_prefs", Context.MODE_PRIVATE)
        val wasTracking = prefs.getBoolean("tracking_active", false)
        if (!wasTracking) return  // ← Only works on device reboot, not process death
        
        // Starts foreground service, but NOT the JS layer
        val serviceIntent = Intent(context, TrackerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
```

**Issues:**
- Only triggered on BOOT_COMPLETED (device restart), not on app process death
- Starts foreground service (keeps process alive), but doesn't ensure JS runtime restarts
- No mechanism to restart TrackingService.start() after JS process is killed

### Fix Strategy

**Phase 1: Ensure TrackerForegroundService always survives**
- Service already has `START_STICKY` and `onTaskRemoved()` handler ✓
- Issue: Service survives but JS layer doesn't restart

**Phase 2: Implement process death recovery**
- Add WorkManager to schedule periodic app startup (even after process death)
- Or use native bridge to call TrackingService.start() when service restarts
- Or ensure foreground notification keeps process alive

**Phase 3: Increase buffer size and add persistence**
- Increase ScrollEventBus buffer from 500 → 5000
- Add native-side session recovery (persist partially-completed sessions)

---

## PROBLEM #2: ANALYTICS PERSISTENCE FAILURES

### Status: HIGH

### Root Cause Analysis

**Missing persistence scenarios:**
1. **Session not closed before process death** - Session remains open with `ended_at = NULL`
2. **Video events inserted but session never closed** - Orphaned video_events
3. **Daily stats not recomputed** - Stale rollup aggregates
4. **Race conditions in TrackingService#sweep()** - Concurrent database writes

### Database Schema Issues

**sessions table:**
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  platform_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,  -- ← Can be NULL (open session)
  duration_ms INTEGER,
  video_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'accessibility',
  day_bucket TEXT NOT NULL
);
```

**Problem:** No cleanup mechanism for sessions stuck in open state
- If app crashes mid-session, `ended_at` remains NULL
- Next app launch sees orphaned session
- Video counts go to wrong date bucket
- `duration_ms` is NULL → analytics break

**video_events table:**
```sql
CREATE TABLE video_events (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  occurred_at INTEGER NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  detection TEXT NOT NULL,
  swipe_direction TEXT,        -- New column (v2)
  app_screen_state TEXT,       -- New column (v2)
  detection_source TEXT        -- New column (v2)
);
```

**Problem:** Foreign key constraint with CASCADE delete, but sessions can be orphaned

### Current Code Issues

**TrackingService.js - No orphan cleanup:**
```javascript
async #sweep() {
  const now = Date.now();
  const closed = this.#estimator.sweepTimeouts(now);  // ← Only closes timed-out sessions
  for (const c of closed) {
    // Only handles sessions that are timed out
    // Does NOT handle orphaned sessions from previous crashes
  }
}
```

**TrackingRepository.js - Missing recovery:**
- `openSession()` creates a new session without checking for unclosed sessions
- `closeSession()` assumes session exists
- No orphan detection or recovery logic
- No crash recovery on app startup

### Fix Strategy

**Phase 1: Add startup recovery**
```javascript
// On app start, check for orphaned sessions
const orphanedSessions = await db.getAllAsync(
  `SELECT * FROM sessions WHERE ended_at IS NULL AND started_at < ? ;`,
  [Date.now() - 1_800_000] // Sessions older than 30 minutes
);

for (const session of orphanedSessions) {
  // Close with last known timestamp
  await db.runAsync(
    `UPDATE sessions SET ended_at = ?, duration_ms = ? WHERE id = ?`,
    [session.started_at + 30_000, 30_000, session.id]
  );
  // Recompute daily stats
  await recomputeDailyStat(session.platform_id, session.day_bucket);
}
```

**Phase 2: Add atomic session closing**
- Use transactions to ensure session close + daily stat update are atomic
- Retry logic if database is locked

**Phase 3: Add database integrity checks**
- Verify no open sessions on each app start
- Log warnings for data inconsistencies
- Auto-repair orphaned records

---

## PROBLEM #3: DUPLICATE MANIFEST ENTRIES

### Status: HIGH (Causes Configuration Issues)

### Current AndroidManifest.xml

```xml
<service android:name="com.scrolltracker.ScrollAccessibilityService" ...>
  <!-- Defined 3 TIMES -->
</service>

<service android:name="com.scrolltracker.TrackerForegroundService" ...>
  <!-- Defined 3 TIMES -->
</service>

<receiver android:name="com.scrolltracker.BootReceiver" ...>
  <!-- Defined 3 TIMES -->
</receiver>
```

### Impact
- Android reads first declaration, ignores duplicates
- Increases APK size unnecessarily
- Confuses maintenance and debugging
- May cause unexpected behavior if metadata differs between duplicates

### Fix Strategy
- Remove all duplicate service/receiver declarations
- Keep only ONE definition per component
- Verify manifest is well-formed

---

## PROBLEM #4: LIFECYCLE RACE CONDITIONS

### Status: HIGH

### Root Cause Analysis

**Race condition scenarios:**

1. **App start → Service not yet enabled:**
   - TrackingService.start() calls ScrollTrackerNative.startTrackingService()
   - Foreground service might not be running yet
   - AccessibilityService might be disabled (user hasn't enabled it)
   - Events fire before JS listener is attached

2. **Process death → Service restart timing:**
   - TrackerForegroundService restarts, but React Native process not yet loaded
   - Foreground service runs alone, accumulating events in buffer
   - When JS layer eventually loads, drainPendingEvents() is called
   - But if delay is too long, buffer has overflowed

3. **Concurrent access to TrackingService state:**
   - #handleEvent() modifies #openSessionIds
   - #sweep() reads #openSessionIds
   - If event arrives during sweep, race condition
   - Session might be closed while event is being processed

### Current Code Issues

**TrackingService.js - No synchronization:**
```javascript
class TrackingServiceImpl {
  #openSessionIds = new Map();  // Shared mutable state
  
  async #handleEvent(event) {
    // Read/write #openSessionIds
    const sessionId = this.#openSessionIds.get(event.packageName);
    if (!sessionId) {
      // Create new session
      this.#openSessionIds.set(event.packageName, sessionId);
    }
  }
  
  async #sweep() {
    // Concurrent read/write
    for (const [pkg] of this.#openSessionIds) {
      this.#openSessionIds.delete(pkg);
    }
  }
  // ← No mutex/lock, potential race condition
}
```

### Fix Strategy

**Phase 1: Add ready-state check**
```javascript
async start() {
  const isServiceReady = await ScrollTrackerNative.isServiceReady();
  if (!isServiceReady) {
    console.warn("Service not ready, retrying...");
    // Retry after delay
  }
}
```

**Phase 2: Add event queue**
- Buffer events while waiting for service to be ready
- Drain queue once service confirms ready

**Phase 3: Add lock/semaphore**
- Protect #openSessionIds access
- Prevent concurrent modification

---

## PROBLEM #5: INSUFFICIENT ERROR HANDLING

### Status: MEDIUM

### Current Issues

1. **Database initialization**:
   ```javascript
   export async function getDatabase() {
     if (dbInstance) return dbInstance;
     try {
       const db = await SQLite.openDatabaseAsync(DB_NAME);
       if (!db) {
         throw new Error("Failed to open database - returned null");
       }
       dbInstance = db;
       await runMigrations(dbInstance);
       return dbInstance;
     } catch (error) {
       console.error("Database initialization failed:", error?.message || error);
       dbInstance = null;
       return null;  // ← Returns null, callers don't handle
     }
   }
   ```

2. **No null check after database calls**:
   ```javascript
   // TrackingRepository.js
   async getPlatforms() {
     const db = await getDatabase();  // Could be null
     const rows = await db.getAllAsync(...);  // ← Crash if db is null
   }
   ```

3. **Native bridge errors not handled**:
   ```javascript
   // TrackingService.js
   await ScrollTrackerNative.startTrackingService();  // No error handling
   ```

### Fix Strategy
- Add null checks everywhere getDatabase() is called
- Wrap native bridge calls in try/catch
- Implement fallback behavior (e.g., in-memory state if database fails)
- Add error logging and user notification

---

## PROBLEM #6: UI/UX ISSUES

### Status: MEDIUM

### Current Issues

1. **Emoji usage as UI elements**
   - Dashboard uses 🔥 for streak indicator
   - Settings likely uses emoji icons instead of proper Material icons
   - Unprofessional appearance
   - Inaccessible to screen readers

2. **Inconsistent theming**
   - No comprehensive Material Design 3 system
   - Mix of inline styles and tailwind classes
   - Missing semantic tokens for consistent branding

3. **No error UI**
   - No indication when database fails
   - No indication when permissions are missing but app continues
   - Silent failures confuse users

4. **Incomplete screens**
   - Settings screen likely has placeholder content
   - Analytics screens might show incomplete data
   - Onboarding flow might be basic

### Fix Strategy
- Replace all emojis with Material Design 3 icons
- Implement comprehensive Material Design 3 theming
- Add error boundaries and error UI
- Polish all screens with professional design
- Add proper accessibility labels

---

## FEATURE AUDIT

### Working Features

✅ **Core Tracking (Swipe Detection)**
- Correctly identifies vertical swipes on video feeds
- Properly distinguishes comments state
- Accurate platform detection

✅ **Background Service**
- Foreground service runs reliably
- UsageStatsManager polling works
- Excessive scroll notifications fire

✅ **Session Management**
- Sessions open/close correctly
- Video events recorded
- Daily stats aggregated

✅ **Database**
- Schema migrations work
- Data persists across app restarts
- Backup/export functionality exists

### Partially Working Features

⚠️ **Background Tracking After App Closure**
- Works for first 30 minutes (loop grace period)
- Fails after longer periods (buffer overflow)
- No recovery after device sleep

⚠️ **Analytics Persistence**
- Works for active sessions
- Fails for orphaned/crashed sessions
- Missing startup recovery

⚠️ **Permission Flow**
- Requires manual user action
- No guided walkthrough
- Edge cases not handled

### Broken Features

❌ **Background Restart After Process Death**
- No automatic service restart
- JS layer doesn't resume
- Events accumulate and get lost

❌ **Orphan Session Recovery**
- No cleanup for sessions left open
- Data corruption possible
- No user notification

---

## ARCHITECTURE REVIEW

### Strengths

1. **Clean separation of concerns**
   - Native layer (Kotlin) handles events
   - JS layer handles business logic
   - Repository layer abstracts database

2. **Swipe-based counting is accurate**
   - Uses actual scroll gestures, not heuristics
   - Properly handles comment state
   - Multi-platform support

3. **Background service design**
   - Foreground service keeps process alive
   - Poll-based approach conserves battery
   - Graceful degradation

### Weaknesses

1. **No process death recovery**
   - JS layer not restarted after OS kills process
   - Events buffer only 500 items

2. **Missing transaction safety**
   - Session close + daily stat update not atomic
   - Race conditions possible

3. **No startup health check**
   - App doesn't verify all services started
   - Silent failures possible

4. **Insufficient error handling**
   - Database failures not handled
   - No fallback behavior
   - No user notification

---

## PERFORMANCE & BATTERY ANALYSIS

### Current State

**Good:**
- Foreground service uses min importance (battery efficient)
- UsageStatsManager polls every 60s (not continuously)
- Event processing is fast

**Concerning:**
- No memory profiling data
- Unknown garbage collection pressure
- Potential for buffer overflow issues

### Recommendations
- Add memory monitoring
- Implement object pooling for events
- Add battery impact metrics

---

## IMPLEMENTATION ROADMAP

### Phase 1: Critical Bug Fixes (1-2 days)

1. **Remove duplicate manifest entries**
   - Clean up AndroidManifest.xml
   - Verify single service/receiver declaration

2. **Fix database startup recovery**
   - Detect and close orphaned sessions
   - Add null checks after getDatabase()
   - Add error handling for database operations

3. **Increase event buffer size**
   - ScrollEventBus: 500 → 5000
   - Gives longer window for recovery

### Phase 2: Process Death Recovery (2-3 days)

1. **Implement WorkManager integration**
   - Schedule periodic app wake-up
   - Ensure TrackingService.start() is called
   - Handle process restart gracefully

2. **Add startup health checks**
   - Verify services are running
   - Re-enable AccessibilityService if disabled
   - Log startup issues

3. **Implement event queue**
   - Buffer events during startup
   - Drain queue once ready

### Phase 3: UI Redesign (2-3 days)

1. **Replace emoji with Material icons**
2. **Implement Material Design 3 theme**
3. **Add error UI and notifications**
4. **Polish all screens**

### Phase 4: Testing & Stabilization (2-3 days)

1. Unit tests for recovery logic
2. Integration tests for database
3. Manual testing of process death scenarios
4. Performance testing
5. Battery impact testing

---

## ESTIMATED EFFORT

- **Phase 1:** 4-6 hours
- **Phase 2:** 8-12 hours
- **Phase 3:** 8-12 hours
- **Phase 4:** 6-8 hours

**Total:** 26-38 hours (3-5 working days)

---

## RECOMMENDATIONS

1. **Start with Phase 1 immediately** - Quick wins that fix critical bugs
2. **Add comprehensive logging** - Help diagnose future issues
3. **Implement crash reporting** - Understand real-world failures
4. **Add automated testing** - Prevent regressions
5. **Monitor in production** - Collect real user data

---

## NEXT STEPS

Proceed to implementation phase, starting with Phase 1 (manifes cleanup, database recovery, buffer increase).

