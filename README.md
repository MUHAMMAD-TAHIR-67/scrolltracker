# ScrollTracker

A privacy-first Android app that estimates how many short-form videos you watch
(Instagram Reels, YouTube Shorts, TikTok, Snapchat Spotlight) and how long you
spend on each, entirely on-device.

Built with plain JavaScript + JSX (no TypeScript build step) — shapes are
documented with JSDoc typedefs for editor autocomplete, with zero runtime
cost. Path aliases (`@/*` → `src/*`) are resolved by `babel-plugin-module-resolver`
in `babel.config.js`, and `jsconfig.json` mirrors the same paths purely for
editor intellisense. App icon, adaptive icon, notification icon, and splash
icon are included in `assets/` — swap them for final branding art whenever
you have it.

## Project structure

```
scrolltracker/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.jsx                # Root layout: DB init, permission gate, notifications
│   ├── onboarding/index.jsx       # Explanation + permission requests
│   └── (tabs)/
│       ├── _layout.jsx            # Bottom tab bar
│       ├── dashboard.jsx
│       ├── analytics.jsx
│       ├── goals.jsx
│       ├── focus.jsx
│       └── settings.jsx
├── src/
│   ├── db/
│   │   ├── schema.sql              # Canonical schema (kept in sync with database.ts)
│   │   └── database.js             # expo-sqlite singleton + migration runner
│   ├── features/
│   │   ├── tracking/
│   │   │   ├── types.js
│   │   │   ├── native/ScrollTrackerModule.js   # Typed bridge to Kotlin
│   │   │   ├── repository/TrackingRepository.js # All SQL lives here
│   │   │   ├── services/
│   │   │   │   ├── SessionEstimator.js          # Event -> "new video?" heuristic
│   │   │   │   └── TrackingService.js           # Orchestrator (subscribe, persist, sweep)
│   │   │   └── store/
│   │   │       ├── trackingStore.js             # Live dashboard counts (Zustand)
│   │   │       └── permissionsStore.js
│   │   ├── analytics/utils/{aggregations,csvExport}.js
│   │   ├── goals/store/goalsStore.js
│   │   ├── focus/services/FocusModeService.js
│   │   └── settings/store/settingsStore.js
│   └── shared/components/          # ProgressBar, PlatformCard, PermissionGateBanner
├── android-native/kotlin/          # Kotlin sources, copied into android/ by the config plugin
│   ├── ScrollAccessibilityService.kt
│   ├── ScrollEventBus.kt
│   ├── ScrollTrackerModule.kt
│   ├── ScrollTrackerPackage.kt
│   ├── TrackerForegroundService.kt
│   └── BootReceiver.kt
├── android-native/res/xml/accessibility_service_config.xml
├── plugins/
│   ├── withScrollTrackerAccessibility.js  # Manifest entries + copies native files + registers package
│   └── withUsageStatsPermission.js
├── app.json
└── eas.json
```

This is a **feature-based, clean-architecture layout**: UI (`app/`) never
touches SQL directly, business logic (`services/`) never touches React,
and `repository/` is the single seam between them and storage. Swapping
storage engines or adding a sync backend later only touches the repository.

## SDK version

Targets **Expo SDK 54** (React Native 0.81.5, React 19.1.0, New Architecture
only). Requires **Node.js 20.19.4+**. If you're coming from SDK 52:

- `expo-file-system`'s default export changed to a class-based API
  (`File`/`Directory`/`Paths`) in SDK 54 - `csvExport.js` explicitly imports
  from `expo-file-system/legacy` to keep the function-based API
  (`writeAsStringAsync`, `cacheDirectory`, `EncodingType`) working. The
  legacy path is officially supported today but deprecated upstream; see the
  comment in that file if a future SDK removes it.
- Reanimated 4 pulls in a new peer dependency, `react-native-worklets`
  (included in `package.json`). Its Babel plugin is wired automatically by
  `babel-preset-expo` - don't add `react-native-reanimated/plugin` or
  `react-native-worklets/plugin` to `babel.config.js` manually, it'll
  conflict.
- If you have a previously generated `android/` directory from SDK 52, delete
  it before re-running `expo prebuild` - native build files aren't
  compatible across this jump.

## Setup

```bash
rm -rf android node_modules   # if upgrading from an older SDK, see above
npm install
npx expo prebuild --platform android   # generates android/, runs config plugins
npx expo run:android                   # or: eas build --profile development
```

The config plugins run automatically on every `prebuild` and:
1. Add the `ScrollAccessibilityService`, `TrackerForegroundService`, and
   `BootReceiver` to `AndroidManifest.xml`.
2. Add `<queries>` entries so the app can detect Instagram/YouTube/TikTok/
   Snapchat under Android 11+ package-visibility rules.
3. Copy the Kotlin sources from `android-native/kotlin/` into the generated
   `android/app/src/main/java/com/scrolltracker/` package.
4. Register `ScrollTrackerPackage` inside `MainApplication.kt` (autolinking
   can't find it since it isn't a separate npm module).

## Database schema

SQLite (via `expo-sqlite`'s async API), single file, WAL mode. See
`src/db/schema.sql` for the full DDL. Summary:

| Table | Purpose |
|---|---|
| `platforms` | Static seed: the 4 tracked apps, their package names, brand colors |
| `sessions` | One row per continuous foreground stint in a tracked app |
| `video_events` | One row per detected "new video" event, with a confidence score and detection method — never any content |
| `daily_stats` | Precomputed rollups per platform/day so Dashboard/Analytics never aggregate raw events at read time |
| `goals` | User-defined daily video-count or time limits, per platform or global |
| `streak_days` | One row per day all active goals were respected |
| `focus_sessions` | User-initiated Focus Mode windows |
| `settings` | Key/value app settings (thresholds, onboarding state, theme) |

`video_events` is intentionally the most granular and most disposable table —
it exists to make `daily_stats` auditable and to let the CSV export show
per-session detail, but the app is fully functional even if you truncate it
periodically to bound storage growth (a good candidate for a future
"auto-prune events older than 90 days" migration).

## Accessibility Service strategy

`ScrollAccessibilityService.kt` listens only for three event types, scoped to
the four tracked package names via `accessibility_service_config.xml`:

- `TYPE_WINDOW_STATE_CHANGED` → the user switched to a tracked app
- `TYPE_VIEW_SCROLLED` → a scrollable container moved
- `TYPE_WINDOW_CONTENT_CHANGED` → the visible subtree changed (a
  RecyclerView/ViewPager2 page swap, which is how essentially every
  short-form feed renders "the next video")

`canRetrieveWindowContent` is **false**. The service never calls
`getRootInActiveWindow()` or walks the node tree for text — it only reads the
resource-id and content-description Android already attaches to the fired
event. This is a deliberate architectural choice, not just a permission
default: it makes it structurally impossible for this code path to read
captions, comments, or usernames, regardless of what a future contributor
adds downstream.

Because `AccessibilityService` runs in a process the OS can keep alive
independently of your Activity/JS runtime, `ScrollEventBus.kt` decouples the
event source from the consumer: events either go straight to JS (if the RN
instance is alive and listening) or accumulate in a small bounded ring buffer
that `TrackingService.ts` drains on the next JS start. This means no events
are silently lost if Android reclaims your process while backgrounded — a
real and common occurrence on stock Android after 5–10 minutes of another
app being foregrounded.

## UsageStatsManager integration

Used in two places:

1. **JS-invoked, on demand** (`queryUsageStats` in `ScrollTrackerModule.kt`) —
   a cross-check the Analytics screen or a debug view could use to sanity-check
   accessibility-derived durations against Android's own foreground-time
   ledger for a given app.
2. **Natively, inside `TrackerForegroundService`** — a 60-second poll (not a
   continuous listener) reads `UsageEvents` to detect continuous dwell time
   in a tracked app and fires the "excessive scrolling" notification even if
   the JS runtime has been killed. This is the battery-conscious design: one
   cheap aggregate query per minute, not a wake-lock or a busy loop.

## State management

Zustand, one store per bounded concern (`trackingStore`, `permissionsStore`,
`goalsStore`, `useFocusStore`, `settingsStore`) rather than one global store —
each screen subscribes only to what it renders, and each store's only side
effect is calling into the repository layer. No store contains SQL.

## Estimating video counts: what's actually possible on Android, and what isn't

This is the part worth being direct about, since it shapes every number the
app shows.

**What Android gives you:** structural UI-tree signals (a view scrolled, a
subtree's content changed, a window changed) and coarse per-app foreground
time via `UsageStatsManager`. That's it. There is no OS-level "video started
playing" event, no access to a video player's internal position or index, and
no legitimate way to read another app's playback state without that app
explicitly exposing it (none of the four target apps do).

**What this means for accuracy:**
- A "new video" is *inferred*, not observed — from a scroll event paired with
  a resource-id or content-description change, gated by a minimum dwell time
  (see `SessionEstimator.ts`) to filter out overscroll/bounce gestures that
  don't actually change what's playing.
- App UI updates change resource-ids and view hierarchies across versions
  without notice, so any given heuristic will drift and need periodic
  recalibration — this is why the confidence score and detection method are
  stored per-event (`video_events.confidence`, `.detection`) instead of
  discarded, so you can audit and retune `PLATFORM_PROFILES` in
  `SessionEstimator.ts` against real usage data rather than guessing blind.
- Auto-advancing videos that loop (common on Reels/Shorts when a user is
  passively watching, not scrolling) look identical to "still on the same
  video" from a structural standpoint — the `loopGraceMs` window is a
  best-effort way to avoid over-counting, not a guarantee.
- Split-screen, picture-in-picture, and any app that renders through a
  WebView (rather than native Views) will degrade accuracy further, since
  content changes inside a WebView don't reliably surface as distinct
  `AccessibilityEvent`s the way native RecyclerView items do.
- Counts should be presented to users as **estimates** ("about 42 videos"),
  not as ground truth — the UI in this build deliberately doesn't oversell
  precision (e.g., no false-precision decimals, and CSV exports include the
  `confidence`/`source` columns rather than hiding them).

**Where `UsageStatsManager` helps and where it doesn't:** it's reliable for
*total time in an app*, but it has no concept of "video count" at all — it's
a coarse foreground/background ledger. It's used here as a durability
fallback for duration (native, independent of JS) and a sanity-check source,
never as the video-count signal itself.

**Bottom line:** this design gets meaningfully useful, self-consistent trend
data (is this week worse than last week, which platform dominates, is a
goal being kept) without ever needing accessibility permissions to overreach
into reading content — but it cannot and should not claim frame-perfect
video counts, because no public Android API provides the information needed
to make that claim true.

## Screens (wireframes)

```
Onboarding                Dashboard                 Analytics
┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│ Step 1 of 3     │        │ Today      🔥5d │        │ [Week] Month    │
│                 │        │ 142 videos      │        │ ┌─┬─┬─┬─┬─┬─┬─┐│
│ Understand your │        │                 │        │ │▇│▇│█│▂│▇│▇│▁││
│ scrolling       │        │ ● Reels     38  │        │ └─┴─┴─┴─┴─┴─┴─┘│
│ ...body text... │        │  ▓▓▓▓░░ 38/50  │        │ By platform     │
│                 │        │ ● Shorts    51  │        │  Reels    38%  │
│                 │        │  ▓▓▓▓▓▓ 51/50  │        │  Shorts   40%  │
│    [Continue]   │        │ ● TikTok    40  │        │ [Export CSV]   │
└────────────────┘        │ ● Spotlight 13  │        └────────────────┘
                            └────────────────┘

Goals                      Focus Mode                Settings
┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│ ● Reels   Edit  │        │                 │        │ Permissions     │
│  ▓▓▓▓░░ 38/50  │        │   ⟳ 14:32       │        │  Accessibility ✓│
│ ● Shorts  Edit  │        │   remaining     │        │  Usage Access ✓│
│  ▓▓▓▓▓▓ 51/50  │        │                 │        │ Alerts          │
│ ● TikTok  Set   │        │ [End Session]   │        │  Daily limit  ⚪│
│  No limit set   │        │                 │        │  Excessive 20m │
└────────────────┘        └────────────────┘        └────────────────┘
```

## Known gaps to close before a store release

- Add automated instrumentation tests around `SessionEstimator` using
  recorded real `AccessibilityEvent` traces from each app (per the accuracy
  notes above, this heuristic needs empirical tuning, not just unit tests
  against synthetic input).
- `queryUsageStats`/native poll assume `PACKAGE_USAGE_STATS` is granted;
  add a periodic silent re-check so a revoked permission degrades
  gracefully instead of silently going stale.
- App icons, splash assets, and Play Store data-safety form (this app should
  declare "no data collected/shared" given the local-only design).
