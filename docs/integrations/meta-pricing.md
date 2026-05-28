# Meta WhatsApp pricing refresh

`convex/lib/metaPricing.ts` holds a static USD price-per-message table by country and
category, because Meta's webhooks return only `pricing.category` and `pricing.pricing_model`,
not the raw charge.

## When to update
Meta announces pricing changes on their developer changelog, usually quarterly.

## How to update
1. Open Meta's current WhatsApp pricing page for the countries your schools operate in.
2. Update `META_PRICES_USD` in `convex/lib/metaPricing.ts`.
3. Bump the `PRICES_VERSION` comment.
4. Add any new country your schools onboarded (otherwise it falls back to US prices and logs a warning).
