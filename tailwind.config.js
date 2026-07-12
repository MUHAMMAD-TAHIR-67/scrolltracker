/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0F172A",
        surface: "#1E293B",
        surfaceAlt: "#273549",
        primary: "#6366F1",
        accent: "#22D3EE",
        danger: "#F87171",
        warn: "#FBBF24",
        success: "#34D399",
        muted: "#94A3B8",
        instagram: "#E1306C",
        youtube: "#FF0000",
        tiktok: "#25F4EE",
        snapchat: "#FFFC00",
      },
    },
  },
  plugins: [],
};
