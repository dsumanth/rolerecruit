import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f5f5f7",
          tertiary: "#e8e8ed",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          secondary: "#86868b",
          tertiary: "#aeaeb2",
        },
        accent: {
          DEFAULT: "#0071e3",
          hover: "#0077ed",
          pressed: "#004999",
        },
        success: "#34c759",
        warning: "#ff9f0a",
        danger: "#ff3b30",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: ['"SF Mono"', "Menlo", "Monaco", "monospace"],
      },
      borderRadius: {
        apple: "0.625rem",
      },
      boxShadow: {
        "menu": "0 4px 24px rgba(0, 0, 0, 0.08)",
        "elevation-low": "0 1px 3px rgba(0, 0, 0, 0.04)",
        "elevation-medium": "0 4px 12px rgba(0, 0, 0, 0.06)",
        "elevation-high": "0 8px 30px rgba(0, 0, 0, 0.08)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "200ms",
        slow: "300ms",
      },
      transitionTimingFunction: {
        "apple-ease": "ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
