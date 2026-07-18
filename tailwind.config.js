/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Material Design 3 Dark Theme - Primary Palette
        primary: "#D0BCFF",
        onPrimary: "#381E72",
        primaryContainer: "#4F378B",
        onPrimaryContainer: "#EADDFF",
        
        // Secondary Palette
        secondary: "#CCC2DC",
        onSecondary: "#332D41",
        secondaryContainer: "#4A4458",
        onSecondaryContainer: "#E8DEF8",
        
        // Tertiary Palette
        tertiary: "#EFB8C8",
        onTertiary: "#492532",
        tertiaryContainer: "#633B48",
        onTertiaryContainer: "#FFD8E4",
        
        // Error Palette
        error: "#F2B8B5",
        onError: "#601410",
        errorContainer: "#8C1D18",
        onErrorContainer: "#F9DEDC",
        
        // Background & Surface
        background: "#141218",
        onBackground: "#E6E1E5",
        surface: "#141218",
        onSurface: "#E6E1E5",
        surfaceVariant: "#49454F",
        onSurfaceVariant: "#CAC4D0",
        surfaceContainer: "#211F26",
        surfaceContainerLow: "#1D1B20",
        surfaceContainerLowest: "#0F0D13",
        surfaceContainerHigh: "#2B2930",
        surfaceContainerHighest: "#36343B",
        onSurfaceDisabled: "#938F99",
        
        // Outline
        outline: "#938F99",
        outlineVariant: "#49454F",
        
        // Platform Colors (Material 3 adapted)
        instagram: "#FF6B9D",
        youtube: "#FF8A80",
        tiktok: "#80DEEA",
        snapchat: "#FFFF8D",
        
        // Semantic Colors
        success: "#81C995",
        warning: "#FFC66D",
        info: "#80CBC4",
      },
      fontFamily: {
        display: ["Roboto", "sans-serif"],
        headline: ["Roboto", "sans-serif"],
        title: ["Roboto", "sans-serif"],
        body: ["Roboto", "sans-serif"],
        label: ["Roboto", "sans-serif"],
      },
      fontSize: {
        // Display
        "display-large": ["57px", { lineHeight: "64px", fontWeight: "400" }],
        "display-medium": ["45px", { lineHeight: "52px", fontWeight: "400" }],
        "display-small": ["36px", { lineHeight: "44px", fontWeight: "400" }],
        
        // Headline
        "headline-large": ["32px", { lineHeight: "40px", fontWeight: "400" }],
        "headline-medium": ["28px", { lineHeight: "36px", fontWeight: "400" }],
        "headline-small": ["24px", { lineHeight: "32px", fontWeight: "400" }],
        
        // Title
        "title-large": ["22px", { lineHeight: "28px", fontWeight: "400" }],
        "title-medium": ["16px", { lineHeight: "24px", fontWeight: "500" }],
        "title-small": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        
        // Body
        "body-large": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-medium": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-small": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        
        // Label
        "label-large": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-medium": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "label-small": ["11px", { lineHeight: "16px", fontWeight: "500" }],
      },
      spacing: {
        "0": "0dp",
        "1": "4dp",
        "2": "8dp",
        "3": "12dp",
        "4": "16dp",
        "5": "20dp",
        "6": "24dp",
        "7": "28dp",
        "8": "32dp",
        "9": "36dp",
        "10": "40dp",
        "11": "44dp",
        "12": "48dp",
        "14": "56dp",
        "16": "64dp",
      },
      borderRadius: {
        "none": "0dp",
        "sm": "4dp",
        "md": "8dp",
        "lg": "12dp",
        "xl": "16dp",
        "2xl": "20dp",
        "3xl": "24dp",
        "full": "9999dp",
      },
      elevation: {
        "0": "0dp 0dp 0dp 0dp rgba(0,0,0,0.2), 0dp 0dp 0dp 0px rgba(0,0,0,0.14), 0dp 0dp 0px 0px rgba(0,0,0,0.12)",
        "1": "0dp 1px 2px 0px rgba(0,0,0,0.3), 0dp 1px 3px 1px rgba(0,0,0,0.15)",
        "2": "0dp 1px 2px 0px rgba(0,0,0,0.3), 0dp 2px 6px 2px rgba(0,0,0,0.15)",
        "3": "0dp 1px 3px 0px rgba(0,0,0,0.3), 0dp 4px 8px 3px rgba(0,0,0,0.15)",
        "4": "0dp 2px 3px 0px rgba(0,0,0,0.3), 0dp 6px 10px 4px rgba(0,0,0,0.15)",
        "5": "0dp 4px 4px 0px rgba(0,0,0,0.3), 0dp 8px 12px 6px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};
