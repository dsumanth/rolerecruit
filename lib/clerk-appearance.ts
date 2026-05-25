import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#0071e3",
    colorBackground: "transparent",
    colorText: "var(--ink-1)",
    colorTextSecondary: "var(--ink-2)",
    colorInputBackground: "var(--card-bg)",
    colorInputText: "var(--ink-1)",
    borderRadius: "10px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: "14px",
  },
  elements: {
    card: "shadow-elev-3 border border-hairline bg-surface backdrop-blur-20",
    formButtonPrimary: "bg-accent hover:opacity-90 rounded-full text-body-s font-medium",
    socialButtonsBlockButton: "rounded-md border-hairline-strong",
    footerActionLink: "text-accent",
    formFieldInput: "border-hairline-strong focus:border-accent focus:ring-2 focus:ring-accent-soft rounded-sm",
    headerTitle: "text-display-s text-ink",
    headerSubtitle: "text-body-s text-ink-secondary",
  },
};
