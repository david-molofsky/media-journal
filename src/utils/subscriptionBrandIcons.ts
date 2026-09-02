import type { BrandIconSlug } from '@/utils/brandIcons';

/**
 * Maps a subscription source's exact name (the same string used in
 * `metadata.source`, `DEFAULT_SUBSCRIPTION_SOURCES`, and
 * `SUBSCRIPTION_TIER_TABLES`) to the simple-icons slug that renders
 * its real logo via `<BrandIcon>` — the same white-badge treatment
 * already used for the welcome screen's import-source boxes (see
 * brandIcons.ts). Deliberately keyed by source name here rather than
 * baked into brandIcons.ts itself, since that file is the general
 * icon registry and this mapping is specific to how the Subscriptions
 * page decides which logo to show for which flagged source.
 *
 * A source missing here falls back to a colour-coded initial badge
 * (`SUBSCRIPTION_FALLBACK_COLOURS` below, or a neutral grey) — either
 * because no simple-icons mark exists for it at all (checked: Disney+,
 * Amazon Prime Video, Hulu, NOW TV), or because it's a self-hosted/
 * custom source with no brand mark to begin with. See
 * `SubscriptionLogo` in SubscriptionsPage.tsx.
 */
export const SUBSCRIPTION_LOGO_SLUGS: Partial<Record<string, BrandIconSlug>> = {
  Netflix: 'netflix',
  Spotify: 'spotify',
  'Apple TV+': 'appletv',
  Audible: 'audible',
  Max: 'hbomax',
  Crunchyroll: 'crunchyroll',
  'Apple Podcasts': 'applepodcasts',
  YouTube: 'youtube',
  Kobo: 'kobo',
  Overcast: 'overcast',
};

/** Fallback badge colour for sources with no real logo mark above —
 * real brand colours for the ones confirmed in scoping (matches
 * `subscriptionPricing.ts`'s 9 hardcoded services), so the calculator
 * still reads as branded even without an actual mark. Anything else
 * (self-hosted sources, custom typed-in names) falls back further to
 * a neutral grey circle with the source's first letter. */
export const SUBSCRIPTION_FALLBACK_COLOURS: Record<string, string> = {
  'Disney+': '#113CCF',
  'Amazon Prime Video': '#00A8E1',
  Hulu: '#1CE783',
  'NOW TV': '#00A0E4',
};
