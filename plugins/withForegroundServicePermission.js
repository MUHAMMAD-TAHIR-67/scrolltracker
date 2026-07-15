const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds the FOREGROUND_SERVICE permission required to run a foreground service
 * on Android 12+. This is needed for the TrackerForegroundService to work.
 */
module.exports = function withForegroundServicePermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest["uses-permission"] = manifest.manifest["uses-permission"] ?? [];

    const entry = manifest.manifest["uses-permission"].find(
      (p) => p.$["android:name"] === "android.permission.FOREGROUND_SERVICE"
    );

    if (!entry) {
      manifest.manifest["uses-permission"].push({
        $: {
          "android:name": "android.permission.FOREGROUND_SERVICE",
        },
      });
    }

    return config;
  });
};
