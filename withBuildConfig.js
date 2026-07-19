const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withBuildConfig(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('buildConfig = true')) {
      if (config.modResults.contents.includes('buildFeatures')) {
        config.modResults.contents = config.modResults.contents.replace(
          /buildFeatures\s*{/,
          'buildFeatures {\n        buildConfig = true'
        );
      } else {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*{/,
          'android {\n    buildFeatures {\n        buildConfig = true\n    }'
        );
      }
    }
    return config;
  });
};
