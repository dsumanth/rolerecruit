import Link from "next/link";
import { cn } from "@/lib/utils";
import { SchoolLogo } from "@/components/careers/SchoolLogo";

interface MarketingTopbarProps {
  schoolName: string;
  schoolSlug: string;
  logoUrl?: string | null;
  className?: string;
}

export function MarketingTopbar({ schoolName, schoolSlug, logoUrl, className }: MarketingTopbarProps) {
  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center justify-between px-9 py-4 bg-surface-chrome backdrop-blur-20 border-b border-hairline",
      className,
    )}>
      <Link href={`/careers/${schoolSlug}`} className="flex items-center gap-2.5">
        <SchoolLogo name={schoolName} logoUrl={logoUrl} size="chip" />
        <span className="text-title-m text-ink">{schoolName}</span>
      </Link>
      <nav className="flex items-center gap-4">
        <Link href={`/careers/${schoolSlug}#about`} className="text-body-s font-medium text-ink-secondary hover:text-ink transition-colors">
          About
        </Link>
        <Link href={`/careers/${schoolSlug}#open-positions`} className="text-body-s font-medium text-ink-secondary hover:text-ink transition-colors">
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
