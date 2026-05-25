import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
  className?: string;
}

const paddingClasses = {
  sm: "p-4",
  md: "p-5",
  lg: "p-8",
};

export function Card({
  children,
  hover = false,
  padding = "md",
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-apple bg-surface shadow-elevation-low transition-all duration-normal ease-apple-ease",
        hover && "hover:shadow-elevation-medium hover:border-accent/20",
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
