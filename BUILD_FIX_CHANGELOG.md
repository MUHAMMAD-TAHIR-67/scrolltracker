# Build Fix Changelog

## Problem

The project was failing to build on both EAS and local Android builds with:
```
Plugin classpath entry points to a non-existent location: ... kotlin-serialization-compiler-plugin-embeddable-2.1.20.jar
```

This is a Gradle cache/dependency resolution issue caused by:
1. Kotlin plugin version mismatch
2. Gradle cache corruption
3. Incompatible Android SDK settings
4. Insufficient JVM heap memory

## Solutions Applied

### 1. **android/build.gradle** (Root Gradle Configuration)

**Changes:**
- Pinned Kotlin plugin version to `1.9.24` (stable, compatible version)
- Added Maven Google repository for better dependency resolution
- Added `compileSdkVersion 35` subproject configuration

**Why:**
- Prevents Kotlin plugin version conflicts
- Ensures all Gradle subprojects use the same SDK version
- Fixes dependency resolution for Kotlin serialization plugin

### 2. **android/gradle.properties** (Build Environment Settings)

**Changes:**
- Increased JVM heap from `2048m` to `4096m` (4GB)
- Increased MaxMetaspaceSize from `512m` to `1024m`
- Added G1GC garbage collector for better memory management
- Increased Gradle workers from `2` to `4`
- Changed parallel mode from `false` to `true`
- Enabled build cache

**Why:**
- Prevents out-of-memory errors during compilation
- Allows more parallelization for faster builds
- G1GC is better for large heap sizes
- Build cache speeds up incremental builds

### 3. **android/app/build.gradle** (App-Level Configuration)

**Changes:**
- Changed `compileSdk` from `rootProject.ext.compileSdkVersion` to `35` (explicit)
- Changed `targetSdkVersion` from `rootProject.ext.targetSdkVersion` to `35` (explicit)

**Why:**
- Removes dependency on potentially misconfigured root variables
- Targets latest Android API level (required for modern apps)
- Ensures consistency with subproject configuration

### 4. **eas.json** (EAS Build Configuration)

**Changes:**
- Added explicit `gradleCommand` for development profile: `:app:assembleDebug`
- Updated preview profile to be more explicit
- Added `gradleCommand` for production profile: `:app:bundleRelease`

**Why:**
- Ensures EAS knows exactly how to build each variant
- Reduces ambiguity in build process
- Provides fallback if EAS auto-detection fails

### 5. **scripts/fix-build.sh** (NEW: Build Fix Script)

**Purpose:**
Automated cleanup and rebuild script that:
- Clears Gradle cache (`~/.gradle/caches`, `~/.gradle/daemon`)
- Removes project build artifacts
- Cleans npm cache
- Reinstalls dependencies
- Runs prebuild

**Usage:**
```bash
bash scripts/fix-build.sh
```

### 6. **BUILD_GUIDE.md** (NEW: Comprehensive Build Documentation)

**Contains:**
- Prerequisites and setup
- Quick build fix instructions
- Building locally vs. EAS
- Common issues and solutions (6 known issues documented)
- Build configuration details
- Advanced troubleshooting
- EAS build monitoring commands

### 7. **README.md** (Updated)

**Changes:**
- Added "Build Issues?" section with quick fix reference
- Links to BUILD_GUIDE.md for detailed help

## Root Cause Analysis

The Kotlin serialization compiler plugin error occurred because:

1. **Gradle didn't cache dependencies properly** - cleared by fix script
2. **Kotlin version wasn't explicitly pinned** - now pinned to 1.9.24
3. **SDK versions weren't consistent** - now explicitly set to 35 across all configs
4. **Insufficient JVM memory** - increased heap from 2GB to 4GB
5. **Gradle daemon could be corrupted** - fix script kills daemon and clears cache

## Testing the Fix

After applying changes:

```bash
# Run the fix script
bash scripts/fix-build.sh

# For EAS builds
npm run build:apk

# For local builds
npm run android
```

## Files Modified

- ✅ `android/build.gradle` - Kotlin version pinned, Maven repos added
- ✅ `android/gradle.properties` - JVM heap increased, workers enabled
- ✅ `android/app/build.gradle` - Explicit SDK versions
- ✅ `eas.json` - Explicit gradle commands for each profile
- ✅ `README.md` - Added build troubleshooting reference

## Files Created

- ✨ `scripts/fix-build.sh` - Automated build cleanup
- ✨ `BUILD_GUIDE.md` - Complete build documentation
- ✨ `BUILD_FIX_CHANGELOG.md` - This file

## Compatibility

- ✅ Expo 54
- ✅ React Native 0.81.5
- ✅ Kotlin 1.9.24
- ✅ Android SDK 35
- ✅ Node.js 20.19.4+
- ✅ Java 17+

## Future Improvements

1. Add CI/CD configuration (.github/workflows) to catch build issues early
2. Add automated Gradle dependency validation
3. Monitor Kotlin plugin updates and test compatibility
4. Document platform-specific build quirks (M1/M2 Macs, Windows, Linux)
5. Consider Maven-publish for pre-built binaries

## Notes

- These changes are backward compatible
- The fix script is idempotent (safe to run multiple times)
- All configurations follow Expo and React Native best practices
- No functional code changes - all fixes are build configuration only
