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
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Whether TV entries are logged as full seasons or individual episodes. */
export type TvTrackingMode = 'season' | 'episode';

/** UI colour scheme. Persisted in `appSettings` so the preference
 * survives page reloads and PWA restarts. */
export type ColorMode = 'light' | 'dark';
