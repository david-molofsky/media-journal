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
   * Default to `true` (via getSetting's fallback) for every field
   * except `autofillPoster`, which defaults to `false` — poster is the
   * one field that changes what an entry visually looks like, so it's
   * opt-in rather than opt-out. All live at the Settings level (not
   * per-import) so the choice persists across every future auto-fill. */
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
   * default to `true` except `autofillComicCoverImage`, which is
   * opt-in for the same reason `autofillPoster` is. */
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
  /** Set true the first time the onboarding welcome screen is shown
   * (Dashboard, empty-library state on a fresh device) — see
   * WelcomeScreen.tsx. Device-local, like everything pre-sync, so a
   * new device always gets the welcome screen once. Deliberately
   * separate from "library is empty", which can also happen later if
   * every entry gets deleted — that case falls back to the plain
   * PagePlaceholder rather than re-showing onboarding. */
  hasSeenWelcome: 'hasSeenWelcome',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Whether TV entries are logged as full seasons or individual episodes. */
export type TvTrackingMode = 'season' | 'episode';

/** UI colour scheme. Persisted in `appSettings` so the preference
 * survives page reloads and PWA restarts. */
export type ColorMode = 'light' | 'dark';
