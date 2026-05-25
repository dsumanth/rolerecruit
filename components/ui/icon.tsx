import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import React from "react";

type LucideIcon = React.ForwardRefExoticComponent<
  Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
>;

type LucideModule = Record<string, LucideIcon | unknown>;

const iconMap = Object.fromEntries(
  Object.entries(LucideIcons as LucideModule).filter(
    ([, v]) =>
      v != null &&
      typeof v === "object" &&
      typeof (v as { render?: unknown }).render === "function"
  )
) as Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;

interface IconProps extends Omit<LucideProps, "ref"> {
  name: string;
  size?: number;
}

export function Icon({ name, size = 16, strokeWidth, ...props }: IconProps) {
  const Cmp = iconMap[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth ?? (size <= 14 ? 2.4 : 2)}
      {...props}
    />
  );
}
