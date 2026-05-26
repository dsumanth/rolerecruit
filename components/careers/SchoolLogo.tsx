import { nameInitial } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface SchoolLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: "chip" | "hero";
  className?: string;
}

const FALLBACK_CLASSES: Record<NonNullable<SchoolLogoProps["size"]>, { box: string; text: string }> = {
  chip: { box: "h-7 w-7",   text: "text-[14px]" },
  hero: { box: "h-16 w-16", text: "text-[24px]" },
};

const LOGO_CLASSES: Record<NonNullable<SchoolLogoProps["size"]>, string> = {
  chip: "h-7 max-w-[160px]",
  hero: "h-20 max-w-[360px]",
};

export function SchoolLogo({ name, logoUrl, size = "chip", className }: SchoolLogoProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn("w-auto object-contain", LOGO_CLASSES[size], className)}
      />
    );
  }

  const fb = FALLBACK_CLASSES[size];
  return (
    <div className={cn(
      "rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white font-bold flex items-center justify-center tracking-tight",
      fb.box,
      fb.text,
      className,
    )}>
      {nameInitial(name, "·")}
    </div>
  );
}
