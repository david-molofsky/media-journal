/**
 * Real brand marks for the welcome screen's import-source boxes, via
 * simple-icons (https://simpleicons.org, CC0-licensed SVG path data —
 * not scraped from each service's own site). Imported from the
 * 'simple-icons/icons' tree-shakeable subpath so the production bundle
 * only includes the handful of icons actually used here, not the
 * package's full multi-thousand-icon set.
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
} satisfies Record<string, BrandIconData>;

export type BrandIconSlug = keyof typeof BRAND_ICONS;
