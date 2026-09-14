import { trackEvent } from './analyticsService';

export type ImportSource =
  | 'amazon_prime'
  | 'audiobookshelf'
  | 'goodreads'
  | 'imdb'
  | 'jellyfin'
  | 'letterboxd'
  | 'myanimelist'
  | 'netflix'
  | 'plex'
  | 'storygraph'
  | 'trakt';

export type ImportMethod = 'api' | 'csv';

export interface ImportResultAnalytics {
  itemsFound?: number;
  itemsImported: number;
  itemsSkipped?: number;
  itemsFlagged?: number;
  itemsErrored?: number;
}

/**
 * Import analytics deliberately contains counts and fixed identifiers only.
 * Never add filenames, titles, account names, server URLs, or error messages.
 */
export function trackImportStarted(
  importSource: ImportSource,
  importMethod: ImportMethod,
): void {
  trackEvent('import_started', {
    import_source: importSource,
    import_method: importMethod,
  });
}

export function trackImportCompleted(
  importSource: ImportSource,
  importMethod: ImportMethod,
  result: ImportResultAnalytics,
): void {
  trackEvent('import_completed', {
    import_source: importSource,
    import_method: importMethod,
    items_found: result.itemsFound,
    items_imported: result.itemsImported,
    items_skipped: result.itemsSkipped ?? 0,
    items_flagged: result.itemsFlagged ?? 0,
    items_errored: result.itemsErrored ?? 0,
  });
}

export function trackImportFailed(
  importSource: ImportSource,
  importMethod: ImportMethod,
  stage: 'fetch' | 'parse' | 'match' | 'apply',
): void {
  trackEvent('import_failed', {
    import_source: importSource,
    import_method: importMethod,
    failure_stage: stage,
  });
}
