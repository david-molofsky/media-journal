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
  editEntry: '/entry/:id',
  statistics: '/statistics',
  timeline: '/timeline',
  settings: '/settings',
  malCallback: '/settings/mal-callback',
  traktCallback: '/settings/trakt-callback',
} as const;

/** Builds a concrete edit-entry path for a given entry id. */
export function editEntryPath(id: string): string {
  return `/entry/${id}`;
}
