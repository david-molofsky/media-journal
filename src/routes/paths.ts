/**
 * Centralised route paths.
 *
 * Defined once here (rather than scattering string literals through the
 * app) so that navigation, redirects and route definitions all stay in
 * sync. See Technical Architecture Document, section 5.
 */
export const ROUTES = {
  dashboard: '/dashboard',
  library: '/library',
  addEntry: '/entry/new',
  entryDetail: '/entry/:id/view',
  editEntry: '/entry/:id',
  statistics: '/statistics',
  subscriptions: '/subscriptions',
  settings: '/settings',
  malCallback: '/settings/mal-callback',
  traktCallback: '/settings/trakt-callback',
} as const;

/** Builds a concrete entry-detail (read-only view) path for a given
 * entry id — the default landing page when tapping an entry, with a
 * pencil icon to reach the edit form (see chat, Aug 2026). */
export function entryDetailPath(id: string): string {
  return `/entry/${id}/view`;
}

/** Builds a concrete edit-entry path for a given entry id. */
export function editEntryPath(id: string): string {
  return `/entry/${id}`;
}
