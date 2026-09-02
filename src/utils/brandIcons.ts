/**
 * Real brand marks, via simple-icons (https://simpleicons.org,
 * CC0-licensed SVG path data — not scraped from each service's own
 * site). Originally added for the welcome screen's import-source
 * boxes, and reused as-is (same `<BrandIcon>` component) for the
 * Subscriptions page's per-service logos — see
 * `subscriptionBrandIcons.ts` for which source name maps to which
 * slug below. Imported from the 'simple-icons/icons' tree-shakeable
 * subpath so the production bundle only includes the handful of icons
 * actually used here, not the package's full multi-thousand-icon set.
 */

import {
  siLetterboxd,
  siGoodreads,
  siImdb,
  siThestorygraph,
  siMyanimelist,
  siTrakt,
  siGoogledrive,
  siNetflix,
  siAudiobookshelf,
  siJellyfin,
  siPlex,
  siSpotify,
  siAppletv,
  siAudible,
  siHbomax,
  siCrunchyroll,
  siApplepodcasts,
  siYoutube,
  siOvercast,
  siRakutenkobo,
} from 'simple-icons/icons';

export interface BrandIconData {
  /** SVG path data (viewBox is always "0 0 24 24" for simple-icons). */
  path: string;
  /** The brand's own colour, as simple-icons ships it — without a
   * leading '#'. */
  hex: string;
  title: string;
}

export const BRAND_ICONS = {
  letterboxd: siLetterboxd,
  goodreads: siGoodreads,
  imdb: siImdb,
  storygraph: siThestorygraph,
  myanimelist: siMyanimelist,
  trakt: siTrakt,
  googledrive: siGoogledrive,
  netflix: siNetflix,
  audiobookshelf: siAudiobookshelf,
  jellyfin: siJellyfin,
  plex: siPlex,
  // Amazon Prime Video has no simple-icons entry (checked — only
  // primefaces/primeng/primereact/primevue exist, all unrelated). Its
  // box variant uses a plain Material icon in the brand's blue instead
  // of BrandIcon — see AmazonPrimeVideoImportSection.tsx.
  spotify: siSpotify,
  appletv: siAppletv,
  audible: siAudible,
  // HBO Max/Discovery+ — matches the existing 'Max' source name used
  // elsewhere in the app (DEFAULT_SUBSCRIPTION_SOURCES,
  // subscriptionPricing.ts), see subscriptionBrandIcons.ts.
  hbomax: siHbomax,
  crunchyroll: siCrunchyroll,
  applepodcasts: siApplepodcasts,
  youtube: siYoutube,
  overcast: siOvercast,
  // Kobo has no dedicated simple-icons slug — it ships under Rakuten's
  // own mark (Kobo is a Rakuten company), checked against simpleicons.org.
  kobo: siRakutenkobo,
  // Disney+, Amazon Prime Video, Hulu and NOW TV have no simple-icons
  // entry at all (checked) — the Subscriptions page falls back to a
  // colour-coded initial badge for these, see subscriptionBrandIcons.ts.
} satisfies Record<string, BrandIconData>;

export type BrandIconSlug = keyof typeof BRAND_ICONS;
