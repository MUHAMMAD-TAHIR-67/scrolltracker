/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Light green and white theme
        primary: "#10B981",
        primaryLight: "#34D399",
        primaryDark: "#059669",

        // Used in onboarding/goals/settings (Material-style tokens mapped to green theme)
        primaryContainer: "#D1FAE5",
        onPrimaryContainer: "#064E3B",
        onPrimaryContainerDisabled: "#6EE7B7",

        background: "#FFFFFF",
        surface: "#F0FDF4",
        surfaceLight: "#DCFCE7",

        // Surface container variants (used across all screens)
        surfaceContainer: "#F0FDF4",
        surfaceContainerHigh: "#DCFCE7",
        surfaceContainerHighest: "#BBF7D0",

        // On-surface text tokens
        onBackground: "#064E3B",
        onSurface: "#065F46",
        onSurfaceVariant: "#6B7280",
        onSurfaceDisabled: "#9CA3AF",

        // Outline tokens
        outlineVariant: "#A7F3D0",

        text: "#065F46",
        textMuted: "#6B7280",

        success: "#10B981",
        warning: "#F59E0B",
        error: "#DC2626",

        // Platform colors
        instagram: "#E1306C",
        youtube: "#FF0000",
        tiktok: "#00F2EA",
        snapchat: "#FFFC00",
      },
    },
  },
  plugins: [],
};
