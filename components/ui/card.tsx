import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Surface = "card" | "chrome" | "floating";
type Elevation = "floor" | 1 | 2 | 3 | 4;
type Padding = "none" | "sm" | "md" | "lg";

interface CardProps {
  children: ReactNode;
  surface?: Surface;
  elevation?: Elevation;
  interactive?: boolean;
  padding?: Padding;
  className?: string;
}

const surfaceClasses: Record<Surface, string> = {
  card: "bg-surface border border-hairline",
  chrome: "bg-surface-chrome backdrop-blur-24 border border-chrome",
  floating: "bg-surface-floating backdrop-blur-20 border border-chrome",
};

const elevationClasses: Record<string, string> = {
  floor: "",
  "1": "shadow-elev-1",
  "2": "shadow-elev-2",
  "3": "shadow-elev-3",
  "4": "shadow-elev-4",
};

const paddingClasses: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-8",
};

export function Card({
  children,
  surface = "card",
  elevation = 1,
  interactive = false,
  padding = "md",
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg transition-all duration-base ease-apple-out",
        surfaceClasses[surface],
        elevationClasses[String(elevation)],
        interactive && "hover:shadow-elev-2 cursor-pointer",
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
