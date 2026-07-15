#!/bin/bash

# ScrollTracker Build Fix Script
# This script cleans gradle cache and prepares the project for a fresh build

echo "🧹 Cleaning Gradle cache and build files..."

# Clean gradle cache
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon

# Clean project build files
rm -rf android/.gradle
rm -rf android/app/build
rm -rf android/build
rm -rf node_modules

# Clean npm/yarn cache
npm cache clean --force 2>/dev/null || true
yarn cache clean 2>/dev/null || true

echo "✅ Clean complete!"
echo ""
echo "📦 Reinstalling dependencies..."
npm install

echo ""
echo "🔨 Running prebuild..."
npm run prebuild

echo ""
echo "✅ Build preparation complete!"
echo ""
echo "To build for EAS:"
echo "  npm run build:apk      - Build APK for preview"
echo "  npm run build:aab      - Build AAB for production"
echo ""
echo "To build locally:"
echo "  npm run android        - Build and run on Android device/emulator"
