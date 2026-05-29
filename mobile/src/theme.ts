export const colors = {
  ink: "#0a0a0a",
  inkSecondary: "#3f3f46",
  inkTertiary: "#71717a",
  accent: "#0066ff",
  accentSoft: "#e6efff",
  success: "#16a34a",
  successSoft: "#dcfce7",
  warning: "#d97706",
  warningSoft: "#fef3c7",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  surface: "#ffffff",
  surfaceCanvas: "#fafafa",
  surfaceFloating: "rgba(255,255,255,0.94)",
  hairline: "#e4e4e7",
  hairlineStrong: "#d4d4d8",
  inverse: "#ffffff",
} as const;

export const radii = {
  apple: 10,
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const fonts = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

export const motion = {
  fast: 150,
  base: 200,
} as const;
