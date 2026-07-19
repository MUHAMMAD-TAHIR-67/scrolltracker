/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Simple color palette
        primary: "#6366F1",
        primaryLight: "#818CF8",
        primaryDark: "#4F46E5",
        
        background: "#0F172A",
        surface: "#1E293B",
        surfaceLight: "#334155",
        
        text: "#F1F5F9",
        textMuted: "#94A3B8",
        
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        
        // Platform colors
        instagram: "#E1306C",
        youtube: "#FF0000",
        tiktok: "#00F2EA",
        snapchat: "#FFFC00",
      },
      fontFamily: {
        regular: ["System", "sans-serif"],
        medium: ["System", "sans-serif"],
        bold: ["System", "sans-serif"],
      },
      fontSize: {
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
      },
      spacing: {
        "0": "0",
        "1": "4",
        "2": "8",
        "3": "12",
        "4": "16",
        "5": "20",
        "6": "24",
        "8": "32",
        "10": "40",
        "12": "48",
      },
      borderRadius: {
        "sm": "6",
        "md": "10",
        "lg": "14",
        "xl": "18",
        "2xl": "22",
        "full": "9999",
      },
    },
  },
  plugins: [],
};
