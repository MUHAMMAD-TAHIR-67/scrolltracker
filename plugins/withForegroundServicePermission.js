const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds the FOREGROUND_SERVICE permission required to run a foreground service
 * on Android 12+. This is needed for the TrackerForegroundService to work.
 */
module.exports = function withForegroundServicePermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest["uses-permission"] = manifest.manifest["uses-permission"] ?? [];

    const requiredPermissions = [
      "android.permission.FOREGROUND_SERVICE",
      // Required on Android 14+ (API 34+) because TrackerForegroundService
      // declares android:foregroundServiceType="dataSync". Without this,
      // startForeground() throws at runtime and the service crashes silently.
      "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
    ];

    for (const permissionName of requiredPermissions) {
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
    }

    return config;
  });
};