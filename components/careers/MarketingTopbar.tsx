import Link from "next/link";
import { cn } from "@/lib/utils";

interface MarketingTopbarProps {
  schoolName: string;
  schoolSlug: string;
  className?: string;
}

function initial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "·";
}

export function MarketingTopbar({ schoolName, schoolSlug, className }: MarketingTopbarProps) {
  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center justify-between px-9 py-4 bg-[rgba(250,250,250,0.75)] backdrop-blur-20 border-b border-hairline",
      className,
    )}>
      <Link href={`/careers/${schoolSlug}`} className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-[14px] font-bold flex items-center justify-center tracking-tight">
          {initial(schoolName)}
        </div>
        <span className="text-title-m text-ink">{schoolName}</span>
      </Link>
      <nav className="flex items-center gap-4">
        <Link href={`/careers/${schoolSlug}`} className="text-body-s font-medium text-ink-secondary hover:text-ink transition-colors">
          About
        </Link>
        <Link href={`/careers/${schoolSlug}/jobs`} className="text-body-s font-medium text-ink-secondary hover:text-ink transition-colors">
          Open roles
        </Link>
        <Link
          href={`/careers/${schoolSlug}/apply`}
          className="rounded-full bg-ink text-surface-canvas px-3.5 py-1.5 text-body-s font-medium hover:opacity-90 transition-opacity"
        >
          Apply
        </Link>
      </nav>
    </header>
  );
}
