const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * android.permission.PACKAGE_USAGE_STATS cannot be granted through the normal
 * runtime-permission dialog - the user must flip it on manually in
 * Settings > Apps > Special access > Usage access (see
 * ScrollTrackerModule.openUsageAccessSettings()). Expo's `permissions` array
 * in app.json already inserts the <uses-permission> tag; this plugin only
 * adds tools:ignore="ProtectedPermissions" so release lint doesn't fail the
 * build on a permission it correctly can't auto-grant.
 */
module.exports = function withUsageStatsPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest["uses-permission"] = manifest.manifest["uses-permission"] ?? [];

    const entry = manifest.manifest["uses-permission"].find(
      (p) => p.$["android:name"] === "android.permission.PACKAGE_USAGE_STATS"
    );

    if (entry) {
      entry.$["tools:ignore"] = "ProtectedPermissions";
    } else {
      manifest.manifest["uses-permission"].push({
        $: {
          "android:name": "android.permission.PACKAGE_USAGE_STATS",
          "tools:ignore": "ProtectedPermissions",
        },
      });
    }

    // Ensure the `tools` namespace is declared on the manifest root, or the
    // attribute above will fail the XML build.
    manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    return config;
  });
};
