import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink-1)",
          secondary: "var(--ink-2)",
          tertiary: "var(--ink-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          soft: "var(--accent-soft)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        purple: "var(--purple)",
        surface: {
          DEFAULT: "var(--card-bg)",
          elev: "var(--card-elev-bg)",
          chrome: "var(--chrome-bg)",
          floating: "var(--floating-bg)",
          canvas: "var(--canvas-base)",
          marketing: "var(--marketing-base)",
          secondary: "var(--canvas-base)",   // bridge: plan 2 migrates call sites
          tertiary: "var(--hairline)",         // bridge: plan 2 migrates call sites
        },
        hairline: {
          DEFAULT: "var(--hairline)",
          strong: "var(--hairline-strong)",
        },
      },
      backgroundImage: {
        "accent-grad": "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
      },
      borderColor: {
        DEFAULT: "var(--hairline)",
        chrome: "var(--chrome-border)",
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
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      boxShadow: {
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
        "elev-4": "var(--elev-4)",
        "elevation-low": "var(--elev-1)",
        "elevation-medium": "var(--elev-2)",
        "elevation-high": "var(--elev-3)",
        "menu": "var(--elev-3)",
      },
      transitionDuration: {
        instant: "100ms",
        fast: "180ms",
        base: "240ms",
        slow: "360ms",
        normal: "240ms",
      },
      transitionTimingFunction: {
        "apple-out": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "apple-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "apple-ease": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      backdropBlur: {
        "20": "20px",
        "24": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
