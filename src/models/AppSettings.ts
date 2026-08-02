/**
 * Application settings.
 *
 * Stored as key/value rows (Database Schema & Data Model, section 6)
 * rather than a single fixed-shape record, so future feature flags can
 * be added without a schema migration.
 */
export interface AppSettingRecord {
  key: string;
  value: unknown;
}

/** Known setting keys used by the app today. Other keys may be added
 * in future milestones without changing the table shape. */
export const SETTINGS_KEYS = {
  selectedTheme: 'selectedTheme',
  lastViewedYear: 'lastViewedYear',
  importExportVersion: 'importExportVersion',
  tvTrackingMode: 'tvTrackingMode',
  colorMode: 'colorMode',
  lastLibraryStatusTab: 'lastLibraryStatusTab',
  /** TMDB (Film/TV) auto-fill toggles — read by tmdbService before it
   * populates each field, written from Settings > Metadata auto-fill.
   * Default to `true` (via getSetting's fallback) for every field,
   * including `autofillPoster` — now that Library/Wishlist cards and
   * the share card both show a poster thumbnail (see chat), leaving it
   * off by default meant most new entries had nothing to show. All
   * live at the Settings level (not per-import) so the choice persists
   * across every future auto-fill. */
  autofillOverview: 'autofillOverview',
  autofillRuntime: 'autofillRuntime',
  autofillProductionCompany: 'autofillProductionCompany',
  autofillTvStatus: 'autofillTvStatus',
  autofillSeries: 'autofillSeries',
  autofillPoster: 'autofillPoster',
  /** Google Drive automatic daily backup. `autoBackupEnabled` is the
   * user-facing toggle (Settings > Google Drive); `lastAutoBackupAt` is
   * an ISO timestamp written after each successful automatic run, used
   * both to display "last backup" and to decide whether today's backup
   * has already happened (see useAutoBackup). Never set for manual
   * exports — those are a separate, unrelated action. */
  autoBackupEnabled: 'autoBackupEnabled',
  lastAutoBackupAt: 'lastAutoBackupAt',
  /** ComicVine (Comic Issues) auto-fill toggles — read by
   * ComicVineAutofillSection.tsx (Settings > Metadata auto-fill
   * (ComicVine)). Same convention as the TMDB toggles above: all
   * default to `true`, including `autofillComicCoverImage` — see
   * matching comment on `autofillPoster`. */
  autofillComicPublisher: 'autofillComicPublisher',
  autofillComicIssueTitle: 'autofillComicIssueTitle',
  autofillComicCoverDate: 'autofillComicCoverDate',
  autofillComicWriter: 'autofillComicWriter',
  autofillComicPenciller: 'autofillComicPenciller',
  autofillComicInker: 'autofillComicInker',
  autofillComicColorist: 'autofillComicColorist',
  autofillComicLetterer: 'autofillComicLetterer',
  autofillComicCoverArtist: 'autofillComicCoverArtist',
  autofillComicEditor: 'autofillComicEditor',
  autofillComicCoverImage: 'autofillComicCoverImage',
  /** ISO 3166-1 alpha-2 region code used for TMDB/JustWatch streaming
   * availability lookups (Settings > Region). Read by tmdbService
   * before every watch-providers call. Defaults to 'GB' via
   * getSetting's fallback, matching the value that was previously
   * hardcoded — existing users see no change until they actively
   * update it in Settings. Scoped only to streaming lookups, not
   * metadata language or search results. */
  watchProviderRegion: 'watchProviderRegion',
  /** MyAnimeList OAuth (PKCE) tokens — read/written by malService.ts.
   * `malTokenExpiresAt` is an ISO timestamp used to decide whether a
   * refresh is needed before the next API call. All three are cleared
   * together on disconnect. Presence of `malAccessToken` is what
   * Settings uses to show "Connected" vs "Connect" for MyAnimeList. */
  malAccessToken: 'malAccessToken',
  malRefreshToken: 'malRefreshToken',
  malTokenExpiresAt: 'malTokenExpiresAt',
  /** Trakt OAuth tokens — read/written by traktService.ts. Same
   * shape and convention as the MAL keys above. */
  traktAccessToken: 'traktAccessToken',
  traktRefreshToken: 'traktRefreshToken',
  traktTokenExpiresAt: 'traktTokenExpiresAt',
  /** Set true the first time the onboarding welcome screen is shown
   * (Dashboard, empty-library state on a fresh device) — see
   * WelcomeScreen.tsx. Device-local, like everything pre-sync, so a
   * new device always gets the welcome screen once. Deliberately
   * separate from "library is empty", which can also happen later if
   * every entry gets deleted — that case falls back to the plain
   * PagePlaceholder rather than re-showing onboarding. */
  hasSeenWelcome: 'hasSeenWelcome',
  /** How many times the "want more media types?" tip card has been
   * shown on the Add Entry media-type grid (WelcomeScreen's sibling
   * nudge for a new, trimmed-down default media type list — see
   * chat). Increments on both a successful entry save and an explicit
   * dismissal of the card, capped at 5; the card stops rendering once
   * this reaches 5. Device-local, same as `hasSeenWelcome` — a new
   * device on an existing account sees it again. */
  addEntryTipShownCount: 'addEntryTipShownCount',
  /** Per-media-type map of which `metadata.source` values count as a
   * paid subscription, for the Statistics > Subscription Value
   * feature (Settings > Subscriptions). Shape: `Record<mediaTypeId,
   * Record<sourceValue, boolean>>`. Seeded on first read from
   * DEFAULT_SUBSCRIPTION_SOURCES (subscriptionSourcesService.ts)
   * rather than at install time, so it stays in sync if that default
   * list is ever extended later. */
  subscriptionSources: 'subscriptionSources',
  /** Per-year, per-media-type consumption targets (Dashboard > Goals).
   * Shape: `Record<year, Record<mediaTypeId, number>>` — see
   * goalsService.ts. Registered here (rather than goalsService.ts
   * using a raw string key) so it's recognised as a "known" setting by
   * importLibrary's restore filter; before this it was written to
   * appSettings under the same key but wasn't in this list, so it
   * exported fine but silently failed to come back on import (see
   * chat — same root cause as wishlistOrder below). */
  yearlyGoals: 'yearly_goals',
  /** Audiobookshelf connection (Settings > Import data). `absAuthMethod`
   * is 'password' or 'token' — whichever the person picked when
   * connecting; `absToken` is always what's actually sent on every
   * request (for password auth, the JWT returned by /login; for token
   * auth, the pasted admin token directly). The password itself is
   * never stored. */
  absServerUrl: 'absServerUrl',
  absAuthMethod: 'absAuthMethod',
  absToken: 'absToken',
  /** Jellyfin connection — same shape as Audiobookshelf's, see above. */
  jellyfinServerUrl: 'jellyfinServerUrl',
  jellyfinAuthMethod: 'jellyfinAuthMethod',
  jellyfinToken: 'jellyfinToken',
  jellyfinUserId: 'jellyfinUserId',
  /** Plex connection. No auth-method choice — a manually-pasted
   * X-Plex-Token is the only supported path (see chat). */
  plexServerUrl: 'plexServerUrl',
  plexToken: 'plexToken',
  /** Welcome screen soft re-framing (see chat — onboarding package).
   * 'fresh' | 'importing' | null (unset). Purely presentational: it
   * reorders/relabels the existing Welcome screen sections rather than
   * hiding either path, and can be changed at any time by re-tapping
   * the toggle. Device-local, same as `hasSeenWelcome`. */
  onboardingPath: 'onboardingPath',
  /** Dashboard "Getting started" checklist card (see chat — onboarding
   * package). True once the user dismisses it via the close icon; the
   * card also stops rendering on its own once every item is complete,
   * independent of this flag. Never reset once set. */
  gettingStartedDismissed: 'gettingStartedDismissed',
  /** One-time dismissible tips on Timeline/Statistics' first empty
   * visit (see chat — onboarding package). Each tip only ever renders
   * while that page's entry count is genuinely zero, so reaching
   * "true" here (or adding a first entry) both permanently retire it. */
  timelineTipDismissed: 'timelineTipDismissed',
  statisticsTipDismissed: 'statisticsTipDismissed',
  /** Google Drive backup nudge banner (see chat — onboarding package).
   * Stores the entry-count threshold (10, 35, 60, ...) the banner was
   * last dismissed at, so it stays hidden until the next threshold is
   * crossed rather than reappearing on every Dashboard visit. Defaults
   * to 0 via getSetting's fallback, so an existing library already
   * past 10 entries with no Drive connected sees it immediately. */
  backupNudgeDismissedThreshold: 'backupNudgeDismissedThreshold',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Whether TV entries are logged as full seasons or individual episodes. */
export type TvTrackingMode = 'season' | 'episode';

/** UI colour scheme. Persisted in `appSettings` so the preference
 * survives page reloads and PWA restarts. */
export type ColorMode = 'light' | 'dark';
