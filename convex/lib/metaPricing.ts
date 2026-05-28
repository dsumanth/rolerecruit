export type MessageCategory = "utility" | "marketing" | "authentication" | "service";

// USD per message. Source: Meta WhatsApp Business Platform pricing.
// Refresh quarterly - see docs/integrations/meta-pricing.md. (PRICES_VERSION: 2025-Q3)
export const META_PRICES_USD: Record<string, Partial<Record<MessageCategory, number>>> = {
  US: { utility: 0.014, marketing: 0.025, authentication: 0.0135, service: 0 },
  IN: { utility: 0.0014, marketing: 0.0073, authentication: 0.0014, service: 0 },
  GB: { utility: 0.0341, marketing: 0.0529, authentication: 0.0319, service: 0 },
  AE: { utility: 0.0157, marketing: 0.0384, authentication: 0.0157, service: 0 },
};

const FALLBACK_COUNTRY = "US";

export function lookupMetaCostUsd(args: {
  countryCode: string | undefined;
  category: MessageCategory;
}): number {
  if (args.category === "service") return 0;
  const country =
    args.countryCode && META_PRICES_USD[args.countryCode] ? args.countryCode : FALLBACK_COUNTRY;
  return META_PRICES_USD[country]?.[args.category] ?? META_PRICES_USD[FALLBACK_COUNTRY][args.category] ?? 0;
}

export function computeBillableUsd(metaCostUsd: number, markupPct: number): number {
  // round to 6 dp to avoid float drift accumulating across rollups
  return Math.round(metaCostUsd * (1 + markupPct / 100) * 1e6) / 1e6;
}
