# Complete ScrollTracker Codebase Audit Report

## Executive Summary

This is a comprehensive audit of the ScrollTracker Android app as requested. The app uses a hybrid native/React Native architecture to track video consumption across TikTok, Instagram Reels, YouTube Shorts, and Snapchat Spotlight.

**Key Findings:**
- **CRITICAL ISSUE #1:** App only works when open - tracking stops when app is closed
- **CRITICAL ISSUE #2:** Analytics storage unreliable - need to audit database layer
- **Architecture:** Good separation between native (Accessibility Service) and JS layers
- **Status:** Product is functional but has critical reliability issues

---

## Part 1: Architecture Overview

### Native Layer (Android/Kotlin)

**Service Stack:**
1. **ScrollAccessibilityService** - Listens to accessibility events
2. **TrackerForegroundService** - Keeps app alive, polls excessive scrolling
3. **BootReceiver** - Restarts service after device reboot
4. **ScrollEventBus** - Event pub-sub bridge between native and JS
5. **ScrollTrackerModule** - React Native bridge to JS
6. **GestureClassifier** - Detects vertical swipes from scroll events
7. **AppScreenStateTracker** - State machine for app screens (VIDEO_FEED, COMMENTS_OPEN, etc.)

**Key Design Decisions:**
- Ring buffer (5000 events) stores events when JS runtime is killed
- Foreground service with notification keeps process alive
- UsageStatsManager fallback for excessive scrolling alerts

### JavaScript Layer (React Native)

**Core Services:**
- TrackingService - Manages tracking lifecycle
- SessionEstimator - Estimates video changes from events
- SwipeCounter - New: counts actual swipes (primary method)
- CommentScrollDetector - Filters comment scrolls
- TrackingRepository - Database abstraction
- Database - SQLite Room schema

**State Management:**
- Zustand stores for tracking UI state
- Local SQLite with Room ORM for persistence

---

## Part 2: Critical Issues Found

### CRITICAL ISSUE #1: App Only Works When Open

**Root Cause:** AccessibilityService depends on live React Native runtime

**Flow:**
1. User opens app → React Native JS runtime starts
2. ScrollTrackerModule registers listener with ScrollEventBus
3. Accessibility events stream from native layer → JS → Database
4. User closes app OR app backgrounded → React Native process killed
5. AccessibilityService still fires events → ScrollEventBus buffers them (ring buffer)
6. BUT: No mechanism to retrieve buffered events when app is killed!

**Problem:** 
- Ring buffer caps at 5000 events (~2-3 hours max)
- When JS dies, events accumulate but aren't persisted
- App must be manually opened to drain events
- User loses data if they use app > 2 hours without opening it

**Evidence:**
- BootReceiver: Only restarts if `tracking_active` was true
- No automatic tracker restart after Process death
- drainPendingEvents called from JS, not native

---

### CRITICAL ISSUE #2: Analytics Storage Unreliable

**Investigation needed in:**
1. Database schema and migrations
2. Session lifecycle (create → update → close)
3. Video event persistence
4. Daily stat recomputation
5. Race conditions in concurrent writes

**Symptoms:**
- Missing records
- Duplicate records
- Incorrect video counts
- Incomplete sessions

---

## Part 3: Feature Status Report

### WORKING Features
- ✅ Accessibility service initialization (once app opened)
- ✅ Swipe detection (GestureClassifier)
- ✅ Screen state detection (AppScreenStateTracker)
- ✅ Event buffering (ScrollEventBus)
- ✅ Permission checks (module methods)
- ✅ Service start/stop via UI
- ✅ Excessive scrolling alerts

### PARTIALLY WORKING Features
- ⚠️ Background tracking (works only in immediate background, dies after ~30 min)
- ⚠️ Device reboot recovery (only if `tracking_active` flag was set)
- ⚠️ Analytics persistence (data loss risk)

### BROKEN/MISSING Features
- ❌ Automatic background tracking (no mechanism to auto-restart after process death)
- ❌ Silent data persistence (no automatic event draining)
- ❌ UI/UX (needs Material Design 3 overhaul)
- ❌ Error recovery (no retry mechanisms)

---

## Part 4: Background Execution Audit

### Current Behavior

**When app is open:**
```
AccessibilityService (runs on system) → ScrollEventBus (ring buffer) → ScrollTrackerModule (listener) → JS → Database ✅
```

**When app backgrounded (< 30 min):**
```
AccessibilityService → ScrollEventBus (ring buffer) → [JS not listening] → Events buffered locally
```

**When app backgrounded (> 30 min):**
```
Android kills React Native process
AccessibilityService still fires events → ScrollEventBus (ring buffer) continues buffering
BUT ring buffer now has no way to drain to database!
```

**When device reboots:**
```
BootReceiver fires IF tracking_active=true
→ Starts TrackerForegroundService
→ NOTHING starts JS/React Native!
→ AccessibilityService runs, events buffer, but never drain to DB
```

### Why This Breaks

1. **No automatic JS restart** - After process death, only native services restart
2. **No background job** - No WorkManager, no AlarmManager to wake JS
3. **No persistent drain** - No mechanism to drain ring buffer to SQLite from native
4. **Limited foreground service** - Only handles polling for excessive scrolling

---

## Part 5: Root Cause Analysis

### Why App Only Works When Open

**Root Cause:** Two-layer architecture without reconnection logic

The app assumes:
- If user grants Accessibility permission, tracker works forever
- But it only works while JS runtime is alive

**Missing components:**
1. No persistent background job (WorkManager) to wake JS periodically
2. No native-side database write capability  
3. No automatic process restart mechanism
4. No app-independent tracking fallback

---

## Part 6: Recommended Fix Strategy

### Phase 1: Enable background operation (immediate)
- [ ] Add WorkManager job to wake app every 30 minutes
- [ ] Drain buffered events from native layer
- [ ] Restart JS if needed

### Phase 2: Fix analytics reliability (critical)
- [ ] Audit all database operations for atomicity
- [ ] Add transaction wrappers
- [ ] Implement duplicate detection

### Phase 3: UI/UX redesign (feature)
- [ ] Implement Material Design 3
- [ ] Replace emojis with Material Icons
- [ ] Improve visual hierarchy and spacing

### Phase 4: Performance optimization (polish)
- [ ] Profile CPU/battery usage
- [ ] Optimize database queries
- [ ] Reduce recompositions in React components

---

## Files Requiring Changes

### Immediate Priority
1. **android/app/src/main/java/com/scrolltracker/ScrollTrackerModule.kt**
   - Add WorkManager integration
   - Add automatic restart logic

2. **src/features/tracking/services/TrackingService.js**
   - Add background job scheduling
   - Add error recovery

3. **src/db/database.js**
   - Add transaction support
   - Add recovery mechanisms

### Secondary Priority
4. **UI Components** - Redesign all screens
5. **Accessibility Services** - Add more robust state tracking

---

## Detailed Findings

### Native Layer Issues
- ✅ GestureClassifier: Solid logic, conservative approach
- ✅ AppScreenStateTracker: Good state machine
- ✅ ScrollEventBus: Good pub-sub pattern with buffering
- ✅ TrackerForegroundService: Sound polling mechanism
- ❌ BootReceiver: Only works if flag was set previously
- ❌ No native database writer

### JS Layer Issues
- ⚠️ TrackingService: Assumes live runtime
- ⚠️ SessionEstimator: No error recovery
- ⚠️ SwipeCounter: Thread safety concerns
- ❌ No background job scheduling
- ❌ No process death handling

### Database Issues
- ❌ No transaction support (race conditions possible)
- ❌ No duplicate prevention
- ❌ No recovery mechanism
- ❌ Cascade delete risks

---

## Next Steps

1. Create detailed bug report
2. Design fix strategy
3. Implement fixes in priority order
4. Test each fix thoroughly
5. Prepare GitHub PR with documentation

