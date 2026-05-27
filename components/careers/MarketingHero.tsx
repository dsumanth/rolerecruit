import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface HeroStat {
  value: string;
  label?: string;
}

interface MarketingHeroProps {
  eyebrow?: string;
  title: string;
  tagline?: string;
  cta?: ReactNode;
  heroImageUrl?: string | null;
  schoolName?: string;
  stats?: HeroStat[];
  className?: string;
}

export function MarketingHero({
  eyebrow,
  title,
  tagline,
  cta,
  heroImageUrl,
  schoolName,
  stats,
  className,
}: MarketingHeroProps) {
  return (
    <section
      className={cn(
        "max-w-[1100px] mx-auto px-6 md:px-12 pt-16 md:pt-20 pb-12 md:pb-16",
        "grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-16 items-center",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-micro text-ink-secondary mb-5 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="text-display-l md:text-display-xl text-ink tracking-tight">
          {title}
        </h1>
        {tagline && (
          <p className="text-body-l text-ink-secondary mt-5 max-w-[460px] leading-relaxed">
            {tagline}
          </p>
        )}
        {cta && <div className="mt-7">{cta}</div>}
        {stats && stats.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s text-ink-tertiary">
            {stats.map((s, i) => (
              <span key={s.value + i} className="inline-flex items-center gap-3">
                {i > 0 && <span className="opacity-40">·</span>}
                <span>
                  {s.value}
                  {s.label && <span className="ml-1">{s.label}</span>}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="aspect-[4/5] rounded-xl overflow-hidden relative bg-gradient-to-br from-[#2a4365] via-[#553c9a] to-[#b794f4]">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={schoolName ? `${schoolName} campus` : "School campus"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_50%)]"
          />
        )}
      </div>
    </section>
  );
}
