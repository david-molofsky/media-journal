/**
 * Hardcoded subscription price tier tables for the Subscriptions
 * calculator — v1 covers US and UK only, per chat (Aug 29 + Sept
 * 2026 scoping). No pricing API exists for this, so these are
 * point-in-time estimates the person can correct via the manual
 * price override (the pencil icon on each card) if a table is stale
 * or a personal plan differs from list price — that override always
 * wins over whatever's here. Keyed by the exact `metadata.source`
 * string already used elsewhere (`DEFAULT_SUBSCRIPTION_SOURCES` in
 * subscriptionSourcesService.ts), so the tier table and the
 * subscription-flag toggle always refer to the same real service.
 */

export type SupportedPricingRegion = 'GB' | 'US';

export interface SubscriptionTier {
  id: string;
  label: string;
  /** Monthly price in the region's own currency (GBP for GB, USD for
   * US) — never converted between currencies. */
  monthlyPrice: number;
}

/** Display currency symbol per supported region. */
export const PRICING_CURRENCY_SYMBOL: Record<SupportedPricingRegion, string> = {
  GB: '£',
  US: '$',
};

/**
 * Tier tables for the 9 services confirmed in scoping (Aug 29 2026).
 * A service missing a region key here (e.g. Hulu has no `GB` entry,
 * NOW TV has no `US` entry) genuinely isn't offered as a standalone
 * product in that market — those fall back to manual-only price entry
 * for a person in that region, same as any source with no table at
 * all. Netflix/Disney+/Apple TV+ GB prices match the confirmed
 * wireframe's example figures exactly; every other figure is a v1
 * estimate — see the module doc comment above re corrections.
 */
export const SUBSCRIPTION_TIER_TABLES: Record<
  string,
  Partial<Record<SupportedPricingRegion, SubscriptionTier[]>>
> = {
  Netflix: {
    GB: [
      { id: 'standard_ads', label: 'Standard with ads', monthlyPrice: 4.99 },
      { id: 'standard', label: 'Standard', monthlyPrice: 10.99 },
      { id: 'premium', label: 'Premium', monthlyPrice: 17.99 },
    ],
    US: [
      { id: 'standard_ads', label: 'Standard with ads', monthlyPrice: 7.99 },
      { id: 'standard', label: 'Standard', monthlyPrice: 17.99 },
      { id: 'premium', label: 'Premium', monthlyPrice: 24.99 },
    ],
  },
  'Disney+': {
    GB: [
      { id: 'standard_ads', label: 'Standard with ads', monthlyPrice: 4.99 },
      { id: 'standard', label: 'Standard', monthlyPrice: 8.99 },
      { id: 'premium', label: 'Premium', monthlyPrice: 12.99 },
    ],
    US: [
      { id: 'standard_ads', label: 'Standard with ads', monthlyPrice: 9.99 },
      { id: 'standard', label: 'Standard (no ads)', monthlyPrice: 15.99 },
      { id: 'premium', label: 'Premium', monthlyPrice: 19.99 },
    ],
  },
  'Amazon Prime Video': {
    GB: [
      { id: 'with_ads', label: 'With ads (included in Prime)', monthlyPrice: 8.99 },
      { id: 'ad_free', label: 'Ad-free add-on', monthlyPrice: 10.98 },
    ],
    US: [
      { id: 'with_ads', label: 'With ads (included in Prime)', monthlyPrice: 14.99 },
      { id: 'ad_free', label: 'Ad-free add-on', monthlyPrice: 17.98 },
    ],
  },
  Spotify: {
    GB: [{ id: 'individual', label: 'Individual', monthlyPrice: 11.99 }],
    US: [{ id: 'individual', label: 'Individual', monthlyPrice: 11.99 }],
  },
  Audible: {
    GB: [{ id: 'premium_plus', label: 'Premium Plus (1 credit/mo)', monthlyPrice: 7.99 }],
    US: [{ id: 'premium_plus', label: 'Premium Plus (1 credit/mo)', monthlyPrice: 14.95 }],
  },
  'Apple TV+': {
    GB: [{ id: 'standard', label: 'Standard', monthlyPrice: 8.99 }],
    US: [{ id: 'standard', label: 'Standard', monthlyPrice: 9.99 }],
  },
  // HBO Max/Discovery+ — matches the existing 'Max' source name used
  // elsewhere in the app (DEFAULT_SUBSCRIPTION_SOURCES) rather than
  // its own separate key, so the tier table and subscription flag
  // stay in sync for anyone already logging entries under 'Max'.
  Max: {
    GB: [
      { id: 'basic_ads', label: 'Basic with ads', monthlyPrice: 3.99 },
      { id: 'standard', label: 'Standard', monthlyPrice: 6.99 },
    ],
    US: [
      { id: 'basic_ads', label: 'With ads', monthlyPrice: 9.99 },
      { id: 'standard', label: 'Standard (no ads)', monthlyPrice: 16.99 },
      { id: 'premium', label: 'Premium', monthlyPrice: 20.99 },
    ],
  },
  Hulu: {
    US: [
      { id: 'with_ads', label: 'With ads', monthlyPrice: 9.99 },
      { id: 'no_ads', label: 'No ads', monthlyPrice: 18.99 },
    ],
  },
  // NOW TV / Sky — no existing source string elsewhere in the app to
  // match, so 'NOW TV' was chosen as the most commonly logged name;
  // flag to David if 'Sky' or something else is actually in use, so
  // this key can be corrected to match real entries.
  'NOW TV': {
    GB: [
      { id: 'entertainment', label: 'Entertainment', monthlyPrice: 6.99 },
      { id: 'cinema', label: 'Cinema', monthlyPrice: 9.99 },
      { id: 'hybrid', label: 'Entertainment + Cinema', monthlyPrice: 14.99 },
    ],
  },
};

/** Narrows an arbitrary region code (from Settings > Region, shared
 * with TMDB/JustWatch lookups) down to one of the two pricing regions
 * this module has tables for, or `null` if the person's region isn't
 * one of them — every source falls back to manual-only pricing in
 * that case, same as a source with no table at all. */
export function pricingRegionFor(watchProviderRegion: string): SupportedPricingRegion | null {
  return watchProviderRegion === 'GB' || watchProviderRegion === 'US'
    ? watchProviderRegion
    : null;
}

/** The tier table for `source` in `region`, or `undefined` if none
 * exists — either the source isn't one of the 9 hardcoded services,
 * or it is but isn't offered as a standalone product in that region
 * (e.g. Hulu in GB). */
export function tiersFor(
  source: string,
  region: SupportedPricingRegion | null,
): SubscriptionTier[] | undefined {
  if (!region) return undefined;
  return SUBSCRIPTION_TIER_TABLES[source]?.[region];
}
