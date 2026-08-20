import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import type { EntryStatus } from '@/models';

/**
 * Returns the status tab (Wishlist / In Progress / Completed) the user
 * last had open in Library, so a new entry started from the bottom-nav
 * Add button defaults to matching status — e.g. tapping Add while the
 * Wishlist tab is open starts a new entry already set to Wishlist.
 *
 * Persisted (rather than session-only) so it survives app restarts,
 * consistent with how `lastViewedYear` already works for Statistics.
 * Defaults to `'wishlist'` if Library has never been visited (changed
 * from `'completed'`, see chat, Aug 2026 — this only affects a
 * brand-new install's very first Add; last-viewed-tab matching is
 * otherwise unchanged).
 */
export function useDefaultEntryStatus(): EntryStatus {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get('lastLibraryStatusTab');
      return (record?.value as EntryStatus) ?? 'wishlist';
    }, [], 'wishlist') ?? 'wishlist'
  );
}
