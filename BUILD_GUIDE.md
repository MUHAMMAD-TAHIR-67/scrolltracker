# ScrollTracker Build Guide

## Prerequisites

- Node.js 18+ and npm/yarn
- Java 17 (required for Gradle)
- Android SDK (API 35+) or use Android Studio
- EAS CLI: `npm install -g eas-cli`

## Quick Build Fix

If you're experiencing the Kotlin serialization compiler plugin error, run:

```bash
bash scripts/fix-build.sh
```

This script will:
1. Clear Gradle cache (~/.gradle/caches, ~/.gradle/daemon)
2. Clean project build artifacts
3. Reinstall dependencies
4. Run prebuild for Android

## Building Locally

### For EAS (Recommended for Production)

**Build APK (Preview)**
```bash
npm run build:apk
```

**Build AAB (Production)**
```bash
npm run build:aab
```

### Direct Android Build

```bash
npm run android
```

This builds and runs directly on a connected Android device or emulator.

## Common Issues & Solutions

### 1. "Plugin classpath entry points to a non-existent location" - Kotlin Serialization Error

**Solution:**
```bash
bash scripts/fix-build.sh
```

**Manual fix:**
```bash
# Clear gradle daemon
pkill -f "gradle"

# Clear gradle cache
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon

# Clean project
cd android && ./gradlew clean && cd ..

# Reinstall
npm install
npm run prebuild
```

### 2. "FAILURE: Build failed with an exception" - Generic Build Failure

**Solution:**
```bash
# Full clean and rebuild
rm -rf android/.gradle android/app/build node_modules
npm install
npm run prebuild
```

### 3. "CompilationException" or Kotlin Compile Errors

**Solution:**
```bash
# Update Kotlin compiler
npm install
npm run prebuild
```

### 4. "Gradle sync failed" in Android Studio

**Solution:**
1. File > Sync Now
2. Or manually: `cd android && ./gradlew sync && cd ..`

### 5. Out of Memory (OOM) errors

The gradle.properties has been updated with:
- `org.gradle.jvmargs=-Xmx4096m` (4GB heap)
- `org.gradle.workers.max=4` (parallel workers)

If you still get OOM errors:
```bash
# Edit android/gradle.properties and increase Xmx
org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=1024m
```

### 6. "Duplicate class" errors

**Solution:**
```bash
# Clear all caches and rebuild
bash scripts/fix-build.sh
```

## Build Configuration Details

### gradle.properties (android/)

- **JVM Heap**: 4GB (increased from 512MB default)
- **Max Workers**: 4 (allows parallel builds)
- **Caching**: Enabled for faster rebuilds
- **Kotlin Version**: 1.9.24 (stable, compatible version)

### eas.json Configuration

**Development Profile:**
- Development client enabled
- APK format
- Uses debug build

**Preview Profile:**
- Internal distribution
- APK format
- Uses release build

**Production Profile:**
- AAB (App Bundle) for Play Store
- Release build with minification

### app.json Android Config

- **compileSdk**: 35 (Latest stable)
- **targetSdk**: 35
- **minSdk**: 31
- **New Architecture**: Enabled
- **Kotlin Serialization**: Properly configured
- **Package**: com.scrolltracker

## Project Structure

```
scrolltracker/
├── android/
│   ├── build.gradle         (Root Gradle config - UPDATED)
│   ├── gradle.properties    (Build settings - UPDATED)
│   ├── app/
│   │   └── build.gradle     (App-specific config - UPDATED)
│   └── .gradle/             (Gradle cache - cleared on fix)
├── android-native/          (Custom Kotlin files)
│   ├── kotlin/              (Accessibility & tracking services)
│   └── res/                 (Android resources)
├── plugins/                 (Expo config plugins)
├── app.json                 (Expo config)
├── eas.json                 (EAS build config - UPDATED)
├── package.json
└── scripts/
    └── fix-build.sh         (NEW: Build fix script)
```

## Verifying the Fix

After running `bash scripts/fix-build.sh`:

```bash
# Check gradle version
./android/gradlew --version

# Verify Kotlin plugin
./android/gradlew dependencies | grep kotlin

# Try a test build
npm run prebuild
```

## EAS Build Status

To check build status and logs:

```bash
# View recent builds
eas build:list

# Monitor a specific build
eas build:view <BUILD_ID>

# View detailed logs
eas build:view <BUILD_ID> --logs
```

## Advanced Troubleshooting

### Enable Verbose Gradle Output

```bash
./android/gradlew build -x test --info --debug
```

### Check Dependency Tree

```bash
./android/gradlew dependencies
```

### Validate Gradle Setup

```bash
./android/gradlew validatePlugins
```

## Support

If issues persist after running `bash scripts/fix-build.sh`:

1. Check Java version: `java -version` (requires 17+)
2. Update Android SDK: Open Android Studio > SDK Manager
3. Clear all caches: `rm -rf ~/.gradle ~/.android`
4. Reinstall Node modules: `rm -rf node_modules && npm install`
5. Run the fix script again: `bash scripts/fix-build.sh`

## Notes

- Kotlin version is pinned to 1.9.24 for stability
- compileSdk and targetSdk are set to 35 (latest)
- New Architecture is enabled for better performance
- All configurations have been tested with Expo 54 and React Native 0.81.5
