module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Note: no manual "react-native-reanimated/plugin" (or worklets/plugin)
    // entry here. As of Reanimated 4 + Expo SDK 54, babel-preset-expo wires
    // the worklets Babel plugin automatically when it detects
    // react-native-reanimated/react-native-worklets installed. Adding it
    // manually causes a "duplicate plugin" conflict.
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@": "./src",
            "@app": "./app",
          },
        },
      ],
    ],
  };
};
