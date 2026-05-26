import { cn } from "@/lib/utils";

interface MarketingHeroProps {
  eyebrow?: string;
  title: string;
  body?: string;
  cta?: React.ReactNode;
  className?: string;
  size?: "default" | "compact";
}

export function MarketingHero({ eyebrow, title, body, cta, className, size = "default" }: MarketingHeroProps) {
  return (
    <section className={cn("relative overflow-hidden", className)}>
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_60%)] blur-[40px]" />
        <div className="absolute top-[60px] right-[-60px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--purple)_14%,transparent),transparent_60%)] blur-[40px]" />
        <div className="absolute bottom-[-80px] left-[40%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_60%)] blur-[40px]" />
      </div>

      <div className={cn(
        "relative max-w-[880px] mx-auto px-6 text-center",
        size === "compact" ? "py-14" : "py-24",
      )}>
        {eyebrow && (
          <p className="text-micro text-ink-secondary mb-4 uppercase tracking-[0.06em]">{eyebrow}</p>
        )}
        <h1 className={cn(
          "text-ink tracking-tight",
          size === "compact" ? "text-display-l" : "text-display-xl",
        )}>
          {title}
        </h1>
        {body && (
          <p className="text-body-l text-ink-secondary mt-5 max-w-[640px] mx-auto leading-relaxed">{body}</p>
        )}
        {cta && (
          <div className="mt-8 flex items-center justify-center gap-3">{cta}</div>
        )}
      </div>
    </section>
  );
}
