import { nameInitial } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface SchoolLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: "chip" | "hero";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SchoolLogoProps["size"]>, { box: string; text: string; img: string }> = {
  chip: { box: "h-7 w-7",   text: "text-[14px]", img: "p-0.5" },
  hero: { box: "h-16 w-16", text: "text-[24px]", img: "p-2" },
};

export function SchoolLogo({ name, logoUrl, size = "chip", className }: SchoolLogoProps) {
  const sz = SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      <div className={cn(
        "rounded-sm bg-surface border border-hairline overflow-hidden flex items-center justify-center",
        sz.box,
        className,
      )}>
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={cn("h-full w-full object-contain", sz.img)}
        />
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white font-bold flex items-center justify-center tracking-tight",
      sz.box,
      sz.text,
      className,
    )}>
      {nameInitial(name, "·")}
    </div>
  );
}
