# ScrollTracker - Comprehensive Fix Implementation Plan

## AUDIT PHASE COMPLETE ✅

**Audit Findings:**
- Identified 3 CRITICAL issues blocking production use
- 1 HIGH priority UI/UX issue
- Detailed root cause analysis for each
- Architectural assessment complete

---

## PROBLEM ANALYSIS

### Problem 1: App Only Works When Open
**Severity:** CRITICAL  
**User Impact:** Complete data loss if app not manually opened  

**Technical Details:**
- JS runtime dies when app is closed
- Native events buffer but don't persist to DB
- Ring buffer holds max 5000 events (~2-3 hours)
- No automatic process restart

**Current Flow (BROKEN):**
```
App Open → JS Runtime Starts → Listener Registered → Events Flow → DB ✅
         ↓
App Closed → JS Runtime Dies → Events Buffer → [TRAPPED IN MEMORY] ❌
         ↓
App Reopen → drainPendingEvents Called → Buffered Events → DB ✅
```

**Required Flow (FIX):**
```
App Open/Close/Crash → WorkManager Job → Wakes App → drainPendingEvents → DB ✅
```

### Problem 2: Analytics Storage Unreliable
**Severity:** CRITICAL  
**User Impact:** Incorrect video counts, missing sessions  

**Root Causes:**
1. No database transactions
2. Concurrent write race conditions
3. No duplicate prevention
4. No atomicity guarantees

**Issues in TrackingRepository:**
- Sessions could be created twice concurrently
- Video events might not be associated with session
- Daily stats might be updated partially
- Crash mid-transaction leaves DB in inconsistent state

### Problem 3: No Automatic Background Recovery
**Severity:** CRITICAL  
**User Impact:** Requires manual app open after crash  

**Root Cause:**
- BootReceiver only works if `tracking_active` flag set
- No mechanism to resume from foreground service alone
- No persistent job scheduler

---

## PHASE 1: ENABLE BACKGROUND OPERATION

### Step 1.1: Add WorkManager Dependency
**File:** `android/app/build.gradle`  
**Change:** Add WorkManager library  

```gradle
dependencies {
    implementation 'androidx.work:work-runtime-ktx:2.8.1'
}
```

### Step 1.2: Create BackgroundSyncWorker
**File:** `android/app/src/main/java/com/scrolltracker/BackgroundSyncWorker.kt`  
**Purpose:** Periodic job to drain events and restart tracking  

**Key logic:**
```kotlin
class BackgroundSyncWorker : CoroutineWorker() {
    override suspend fun doWork(): Result {
        // 1. Call JS method to drain pending events
        // 2. If JS not running, start it
        // 3. Persist any buffered events to DB
        // 4. Return success or retry
    }
}
```

### Step 1.3: Schedule Background Job
**File:** `android/app/src/main/java/com/scrolltracker/ScrollTrackerModule.kt`  
**Change:** Add job scheduling in startTrackingService()  

```kotlin
fun startTrackingService() {
    // Existing code...
    
    // Schedule background sync job every 30 minutes
    val syncWork = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
        30, TimeUnit.MINUTES
    ).build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "scroll_tracker_sync",
        ExistingPeriodicWorkPolicy.KEEP,
        syncWork
    )
}
```

### Step 1.4: Update BootReceiver
**File:** `android/app/src/main/java/com/scrolltracker/BootReceiver.kt`  
**Change:** Always start tracking if it was active  

```kotlin
override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    
    val prefs = context.getSharedPreferences("scrolltracker_prefs", Context.MODE_PRIVATE)
    val wasTracking = prefs.getBoolean("tracking_active", false)
    
    if (wasTracking) {
        // Start both foreground service AND schedule background job
        val serviceIntent = Intent(context, TrackerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
        
        // Schedule background sync (will also start JS)
        val syncWork = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
            30, TimeUnit.MINUTES
        ).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(...)
    }
}
```

### Step 1.5: Add Native Event Drain
**File:** `android/app/src/main/java/com/scrolltracker/ScrollTrackerModule.kt`  
**Purpose:** Native-side fallback to persist events if JS unavailable  

**Method:**
```kotlin
@ReactMethod
fun nativeDrainPendingEvents(promise: Promise) {
    // 1. Get pending events from ScrollEventBus
    // 2. Get DB connection
    // 3. Write to database directly (without JS)
    // 4. Return count
}
```

---

## PHASE 2: FIX ANALYTICS STORAGE

### Step 2.1: Add Transaction Wrapper
**File:** `src/db/database.js`  
**Purpose:** Wrap all multi-step operations in transactions  

```javascript
export async function withTransaction(db, callback) {
    try {
        await db.execAsync('BEGIN TRANSACTION');
        const result = await callback(db);
        await db.execAsync('COMMIT');
        return result;
    } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
    }
}
```

### Step 2.2: Fix Session Creation Race Condition
**File:** `src/features/tracking/repository/TrackingRepository.js`  

**Current (BROKEN):**
```javascript
async openSession(packageName, timestamp) {
    const existing = await this.db.getFirstAsync(
        'SELECT id FROM sessions WHERE packageName = ? AND ended_at IS NULL',
        [packageName]
    );
    if (existing) return existing.id; // Race condition!
    
    // Two concurrent calls both see no session, both create one
    const result = await this.db.runAsync(
        'INSERT INTO sessions ...',
        [...]
    );
    return result.lastID;
}
```

**Fixed:**
```javascript
async openSession(packageName, timestamp) {
    return await withTransaction(this.db, async (db) => {
        // Use FOR UPDATE to lock the row
        const existing = await db.getFirstAsync(
            'SELECT id FROM sessions WHERE packageName = ? AND ended_at IS NULL LIMIT 1',
            [packageName]
        );
        
        if (existing) return existing.id;
        
        const result = await db.runAsync(
            'INSERT INTO sessions ...',
            [...]
        );
        return result.lastID;
    });
}
```

### Step 2.3: Add Duplicate Detection
**File:** `src/features/tracking/repository/TrackingRepository.js`  

**Logic:**
```javascript
async appendVideoEvent(sessionId, timestamp) {
    return await withTransaction(this.db, async (db) => {
        // Check for duplicate (same session, within 1 second)
        const recent = await db.getFirstAsync(
            'SELECT id FROM video_events WHERE session_id = ? AND created_at > ? LIMIT 1',
            [sessionId, timestamp - 1000]
        );
        
        if (recent) {
            // Duplicate, return existing
            return recent.id;
        }
        
        // New event
        const result = await db.runAsync(
            'INSERT INTO video_events ...',
            [sessionId, timestamp]
        );
        return result.lastID;
    });
}
```

### Step 2.4: Add Database Constraints
**File:** `src/db/database.js` (migrations)  

**Migration V3:**
```sql
-- Add unique constraint on sessions
ALTER TABLE sessions ADD CONSTRAINT unique_active_session UNIQUE(packageName, ended_at IS NULL);

-- Add index on critical fields
CREATE INDEX idx_sessions_package ON sessions(packageName);
CREATE INDEX idx_video_events_session ON video_events(session_id);
CREATE INDEX idx_daily_stats_day ON daily_stats(app_date);
```

---

## PHASE 3: UI/UX REDESIGN

### Material Design 3 Implementation
**Components to update:**
- Dashboard screen (main)
- Analytics screen
- Settings screen
- Permissions screen
- Onboarding screen

**Changes:**
- Replace all emojis with Material Icons
- Implement proper color system (primary, secondary, tertiary)
- Add Material Design 3 typography
- Improve spacing and layout
- Add proper error states

---

## PHASE 4: PERFORMANCE OPTIMIZATION

### Database Query Optimization
**File:** `src/features/tracking/repository/TrackingRepository.js`  

**Current issues:**
- No indexes on frequently queried fields
- N+1 queries in daily stats calculation
- No query batching

**Fixes:**
- Add indexes (done in Phase 2.4)
- Batch queries with joins
- Implement query caching

---

## IMPLEMENTATION ORDER

### Week 1: Phase 1 (Background Operation)
1. Monday: Add WorkManager dependency, create BackgroundSyncWorker
2. Tuesday: Update ScrollTrackerModule with job scheduling
3. Wednesday: Update BootReceiver with boot-time scheduling
4. Thursday: Add native drain fallback
5. Friday: Test and verify background tracking works

### Week 2: Phase 2 (Analytics Reliability)
1. Monday: Add transaction wrapper and constraints
2. Tuesday: Fix session creation race condition
3. Wednesday: Add duplicate detection
4. Thursday: Add database recovery
5. Friday: Test concurrent writes, verify data integrity

### Week 3: Phase 3 (UI/UX)
1. Monday-Tuesday: Replace emojis with Material Icons
2. Wednesday: Implement Material Design 3 theming
3. Thursday: Improve layouts and spacing
4. Friday: Add accessibility improvements

### Week 4: Phase 4 (Performance)
1. Monday: Database query profiling
2. Tuesday: Implement query batching
3. Wednesday: Add caching layer
4. Thursday-Friday: Performance testing and optimization

---

## TESTING STRATEGY

### Unit Tests
- Session creation with concurrent calls
- Video event insertion with duplicates
- Transaction rollback on error

### Integration Tests
- Background job execution
- Event drain from native to DB
- Process restart after crash

### Manual Tests
- Open app, close app, check data persists
- Leave app closed for 1 hour, reopen, verify no data loss
- Force stop app, reopen, verify recovery
- Check database for duplicates/corruption

---

## RISK MITIGATION

### Risk: Breaking existing tracking
**Mitigation:** Keep swipe-based primary metric unchanged  

### Risk: Data migration issues
**Mitigation:** Create safe migration with rollback path  

### Risk: Background job performance
**Mitigation:** Start with 30-minute interval, monitor battery impact  

---

## APPROVAL CHECKLIST

Before proceeding, confirm:
- [ ] Keep swipe-based tracking as primary metric
- [ ] Preserve existing permission flow  
- [ ] Maintain backward compatibility
- [ ] Do not change core product vision
- [ ] Ready to commit 4-week effort

---

**Status:** Audit complete. Awaiting approval to proceed with fixes.

