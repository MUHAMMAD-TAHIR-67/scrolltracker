# Quick Fix Reference Card 🚀

## The Problem You Had
```
Plugin classpath entry points to a non-existent location: 
... kotlin-serialization-compiler-plugin-embeddable-2.1.20.jar
```

## The Solution (3 seconds)
```bash
bash scripts/fix-build.sh
```

That's it! This one command will:
- Clear Gradle cache
- Clean build artifacts  
- Reinstall dependencies
- Prepare for building

## After Running the Fix Script

### Option A: Build for EAS (Recommended)
```bash
npm run build:apk      # Preview build (faster)
npm run build:aab      # Production build (for Play Store)
```

### Option B: Build Locally
```bash
npm run android        # Build and run on device/emulator
```

## What Was Actually Fixed

| Component | Before | After |
|-----------|--------|-------|
| Kotlin version | Unspecified | 1.9.24 (stable) |
| JVM heap | 2GB | 4GB |
| Gradle workers | 2 | 4 (parallel) |
| Build cache | Disabled | Enabled |
| compileSdk | Variable | 35 (explicit) |
| targetSdk | Variable | 35 (explicit) |

## If It Still Doesn't Work

### Try Step by Step:

**Step 1: Clean Everything**
```bash
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon
rm -rf android/.gradle
rm -rf android/app/build
rm -rf node_modules
```

**Step 2: Reinstall**
```bash
npm install
npm run prebuild
```

**Step 3: Test Build**
```bash
npm run build:apk
```

### Common Issues:

| Issue | Fix |
|-------|-----|
| "Java not found" | Install Java 17+ |
| "Out of memory" | Already fixed in gradle.properties |
| "Gradle daemon stuck" | `pkill -f gradle` |
| "Module not found" | Run `npm install` again |
| "Cannot find android" | Run `npm run prebuild` again |

## Files You Need to Know About

```
📄 FIX_SUMMARY.md              ← Overview of all changes
📄 BUILD_GUIDE.md              ← Detailed troubleshooting (read if stuck)
📄 BUILD_FIX_CHANGELOG.md       ← Technical analysis
📄 QUICK_FIX_REFERENCE.md       ← This file

🔧 scripts/fix-build.sh         ← The magic script
```

## One-Liner Quick Build Test

```bash
bash scripts/fix-build.sh && npm run build:apk
```

## Status Check

All these files were modified/created to fix your issue:

✅ android/build.gradle (modified)
✅ android/gradle.properties (modified)  
✅ android/app/build.gradle (modified)
✅ eas.json (modified)
✅ README.md (updated)
✨ scripts/fix-build.sh (created)
✨ BUILD_GUIDE.md (created)
✨ BUILD_FIX_CHANGELOG.md (created)
✨ FIX_SUMMARY.md (created)
✨ QUICK_FIX_REFERENCE.md (this file)

## For EAS Builds Specifically

```bash
# Check EAS CLI is installed
eas --version

# Build APK for preview/testing
eas build --platform android --profile preview

# Or use the shortcut
npm run build:apk

# Check build status
eas build:list
```

## For Local Android Builds

```bash
# Make sure device is connected or emulator is running
adb devices

# Build and run
npm run android

# Or manual build
npm run prebuild
cd android && ./gradlew assembleDebug && cd ..
```

## Verify It's Actually Fixed

After running fix, check these versions:

```bash
# Check Kotlin version in build.gradle
grep "kotlin-gradle-plugin:" android/build.gradle

# Check JVM settings
grep "org.gradle.jvmargs" android/gradle.properties

# Check SDK version
grep "compileSdk" android/app/build.gradle
```

Expected output:
- Kotlin: 1.9.24
- JVM: -Xmx4096m (4GB)
- SDK: 35

## Emergency: Complete Clean & Rebuild

If all else fails, run this:

```bash
# Kill gradle daemon
pkill -f gradle

# Clean everything
rm -rf ~/.gradle ~/.android node_modules android/.gradle android/app/build

# Reinstall completely
npm install
npm run prebuild

# Test build
npm run build:apk
```

## Need More Help?

1. **Quick Overview**: Read `FIX_SUMMARY.md`
2. **Stuck on an issue**: Read `BUILD_GUIDE.md` (section: "Common Issues & Solutions")
3. **Technical Details**: Read `BUILD_FIX_CHANGELOG.md`
4. **Build Problems**: See "Common Issues" table above

---

**That's it!** You're ready to build. Run `bash scripts/fix-build.sh` and you're good to go! 🎉
