const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE_PATH = "com/scrolltracker";
const KOTLIN_SOURCE_DIR = path.join(__dirname, "..", "android-native", "kotlin");
const XML_SOURCE_DIR = path.join(__dirname, "..", "android-native", "res", "xml");
const VALUES_SOURCE_DIR = path.join(__dirname, "..", "android-native", "res", "values");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, destDir, destName) {
  ensureDir(destDir);
  fs.copyFileSync(src, path.join(destDir, destName ?? path.basename(src)));
}

/** Copies Kotlin sources and the accessibility_service_config.xml into the prebuilt android/ project. */
function withNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const javaDir = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "java",
        ...PACKAGE_PATH.split("/")
      );
      const xmlDir = path.join(androidRoot, "app", "src", "main", "res", "xml");
      const valuesDir = path.join(androidRoot, "app", "src", "main", "res", "values");

      for (const file of fs.readdirSync(KOTLIN_SOURCE_DIR)) {
        copyFile(path.join(KOTLIN_SOURCE_DIR, file), javaDir);
      }
      for (const file of fs.readdirSync(XML_SOURCE_DIR)) {
        copyFile(path.join(XML_SOURCE_DIR, file), xmlDir);
      }
      for (const file of fs.readdirSync(VALUES_SOURCE_DIR)) {
        copyFile(path.join(VALUES_SOURCE_DIR, file), valuesDir);
      }

      return config;
    },
  ]);
}

/** Registers the AccessibilityService, the foreground tracking service, and the boot receiver. */
function withManifestEntries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    application.service = application.service ?? [];
    application.receiver = application.receiver ?? [];

    // 1) Accessibility Service
    application.service.push({
      $: {
        "android:name": "com.scrolltracker.ScrollAccessibilityService",
        "android:label": "ScrollTracker Monitoring",
        "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.accessibilityservice.AccessibilityService" } },
          ],
        },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.accessibilityservice",
            "android:resource": "@xml/accessibility_service_config",
          },
        },
      ],
    });

    // 2) Foreground tracking service (keeps the pipeline alive, shows the ongoing notification)
    application.service.push({
      $: {
        "android:name": "com.scrolltracker.TrackerForegroundService",
        "android:foregroundServiceType": "dataSync",
        "android:exported": "false",
      },
    });

    // 3) Boot receiver to restart the foreground service after a reboot
    application.receiver.push({
      $: {
        "android:name": "com.scrolltracker.BootReceiver",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }],
        },
      ],
    });

    // 4) Package visibility (Android 11+) so we can detect if the tracked apps are installed
    manifest.manifest.queries = manifest.manifest.queries ?? [
      { package: [] },
    ];
    const trackedPackages = [
      "com.instagram.android",
      "com.google.android.youtube",
      "com.zhiliaoapp.musically",
      "com.snapchat.android",
    ];
    manifest.manifest.queries[0].package = trackedPackages.map((name) => ({
      $: { "android:name": name },
    }));

    return config;
  });
}

/**
 * ScrollTrackerPackage isn't an npm module, so Expo's autolinking can't find
 * it - it has to be added to MainApplication.kt's getPackages() manually.
 * This mod does a targeted string insertion rather than a full AST rewrite,
 * so it only touches the one line it needs and is idempotent (safe to run on
 * every prebuild).
 */
function withMainApplicationRegistration(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const mainApplicationPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...config.android.package.split("."),
        "MainApplication.kt"
      );

      if (!fs.existsSync(mainApplicationPath)) return config;

      let contents = fs.readFileSync(mainApplicationPath, "utf8");
      if (contents.includes("ScrollTrackerPackage()")) return config;

      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        `$1\n              add(com.scrolltracker.ScrollTrackerPackage())`
      );

      fs.writeFileSync(mainApplicationPath, contents, "utf8");
      return config;
    },
  ]);
}

module.exports = function withScrollTrackerAccessibility(config) {
  config = withManifestEntries(config);
  config = withNativeFiles(config);
  config = withMainApplicationRegistration(config);
  return config;
};
