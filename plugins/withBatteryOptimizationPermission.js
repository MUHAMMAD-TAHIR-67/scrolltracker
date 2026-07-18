const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission.
 *
 * Without this, calling Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 * (see ScrollTrackerModule.kt#requestIgnoreBatteryOptimizations) throws a
 * SecurityException at runtime - Android silently refuses to launch that
 * settings screen for any app that hasn't declared this permission. That
 * made the in-app "Background battery access" button appear to do nothing.
 */
module.exports = function withBatteryOptimizationPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest["uses-permission"] = manifest.manifest["uses-permission"] ?? [];

    const permissionName = "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS";
    const entry = manifest.manifest["uses-permission"].find(
      (p) => p.$["android:name"] === permissionName
    );

    if (!entry) {
      manifest.manifest["uses-permission"].push({
        $: {
          "android:name": permissionName,
        },
      });
    }

    return config;
  });
};
