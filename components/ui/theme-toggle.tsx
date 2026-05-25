"use client";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{ value: Theme; label: string; icon: "Sun" | "Moon" | "Monitor" }> = [
  { value: "light", label: "Light", icon: "Sun" },
  { value: "dark", label: "Dark", icon: "Moon" },
  { value: "system", label: "Match system", icon: "Monitor" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-md bg-hairline p-1">
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors duration-fast ease-apple-out",
              active ? "bg-surface text-ink shadow-elev-1" : "text-ink-secondary hover:text-ink",
            )}
          >
            <Icon name={o.icon} size={13} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
