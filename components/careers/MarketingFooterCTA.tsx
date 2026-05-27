import Link from "next/link";
import { Icon } from "@/components/ui";

interface Props {
  href: string;
  title?: string;
  body?: string;
  linkText?: string;
}

export function MarketingFooterCTA({
  href,
  title = "Don't see your subject?",
  body = "We hire year-round. Send us a general application and we'll be in touch when something opens.",
  linkText = "Submit a general application",
}: Props) {
  return (
    <section className="max-w-[1100px] mx-auto px-6 md:px-12 py-20 border-t border-hairline text-center">
      <h3 className="text-display-s text-ink tracking-tight mb-2">{title}</h3>
      <p className="text-body text-ink-secondary mb-6 max-w-md mx-auto leading-relaxed">{body}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-body text-accent font-medium hover:opacity-80 transition-opacity"
      >
        {linkText}
        <Icon name="ArrowRight" size={14} />
      </Link>
    </section>
  );
}
