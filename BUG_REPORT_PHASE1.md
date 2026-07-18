# Phase 1: Bug Detection Report

## CRITICAL BUGS FOUND

### BUG #1: SwipeCounter calls undefined function
**File:** `src/features/tracking/services/SwipeCounter.js`
**Line:** Line 54 in `processSwipeEvent()` function
**Issue:** Calls `isCommentScroll(event)` but this function is NOT imported from CommentScrollDetector
**Current Code:**
```javascript
if (isCommentScroll(event)) {
  return { videoDelta: 0 };
}
```
**Problem:** `isCommentScroll` is a local function defined at line 104, but CommentScrollDetector exports `isLikelyCommentScroll` instead
**Severity:** CRITICAL - will cause runtime error "isCommentScroll is not defined"

---

### BUG #2: Function name mismatch between modules
**Files:** 
- `SwipeCounter.js` calls `isCommentScroll()`
- `CommentScrollDetector.js` exports `isLikelyCommentScroll()`
**Issue:** Function names don't match
**Severity:** CRITICAL - breaks comment detection logic

---

### BUG #3: Missing timestamp conversion
**File:** `src/db/database.js`
**Line:** 73 in `recoverOrphanedSessions()`
**Current Code:**
```javascript
const now = Math.floor(Date.now() / 1000);
```
**Problem:** `Date.now()` returns milliseconds, but sessions.started_at is stored in MILLISECONDS too (line 31 in TrackingService shows `event.timestamp` which is `Date.now()`). This creates a mismatch.
**Expected:** Should use milliseconds directly without division
**Severity:** HIGH - orphan recovery won't work correctly

---

### BUG #4: Database exec query error
**File:** `src/db/database.js`
**Line:** 76 in `recoverOrphanedSessions()`
**Current Code:**
```javascript
await db.execAsync(
  `UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL AND started_at < ?`,
  [now, now - 300]
);
```
**Problem:** `execAsync()` doesn't support parameterized queries, should use `runAsync()` instead
**Severity:** CRITICAL - query will fail or use literal values

---

### BUG #5: Missing error handling in database initialization
**File:** `src/db/database.js`
**Line:** 15 in `getDatabase()`
**Current Code:**
```javascript
if (!db) {
  throw new Error("Failed to open database - returned null");
}
```
**Problem:** The catch block below catches this but logs and continues. App then tries to call `.execAsync()` on null
**Severity:** HIGH - can cause cascading null reference errors

---

### BUG #6: Race condition in sessionState Map
**File:** `src/features/tracking/services/SwipeCounter.js`
**Line:** 27 in `processSwipeEvent()`
**Issue:** `sessionState` is a Map accessed from multiple threads (native accessibility service thread + JS event thread) without synchronization
**Current Code:**
```javascript
let state = sessionState.get(key);
```
**Problem:** Between `.get()` and `.set()`, another thread could modify the map
**Severity:** MEDIUM - unlikely but possible in high-load scenarios

---

### BUG #7: Missing null check in database recovery
**File:** `src/db/database.js`
**Line:** 72 in `recoverOrphanedSessions()`
**Current Code:**
```javascript
if (orphanedResult?.count > 0) {
```
**Problem:** If the SELECT returns no rows, `orphanedResult` could be null/undefined
**Severity:** MEDIUM - can crash if SELECT fails

---

### BUG #8: Timestamp format mismatch across layers
**Issue:** Inconsistent timestamp formats:
- Android: `System.currentTimeMillis()` (milliseconds)
- TrackingService: `Date.now()` (milliseconds)
- Database recovery: `Math.floor(Date.now() / 1000)` (seconds) ← WRONG!
**Severity:** HIGH - causes all time-based queries to fail

---

## SUMMARY OF CRITICAL ISSUES

| Bug | Severity | Impact | Fix Time |
|-----|----------|--------|----------|
| SwipeCounter undefined function | CRITICAL | Runtime crash | 2 min |
| Function name mismatch | CRITICAL | Feature broken | 2 min |
| Database exec query | CRITICAL | Recovery fails | 3 min |
| Timestamp mismatch | HIGH | Queries fail | 5 min |
| Missing null check | MEDIUM | Potential crash | 2 min |

**Total Blocking Issues:** 3 CRITICAL + 2 HIGH
**Recommended Fix Order:** Bug #1 → Bug #2 → Bug #4 → Bug #3 → Bug #7

