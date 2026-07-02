import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Distinct years that have at least one entry, newest first — used to
 * populate the Library year filter (UI & UX Specification, section 5)
 * without hard-coding a year range. Reads directly off the indexed
 * `completedYear` field via `keys()` with in-memory dedup.
 *
 * Deliberately avoids `uniqueKeys()`: it opens an IndexedDB cursor with
 * the `nextunique` direction, which WebKit has a long-standing bug with
 * on iOS Safari (throws `UnknownError: Unable to open cursor` and can
 * wedge the database connection for the rest of the session). Plain
 * `keys()` uses the standard `next` direction, which is unaffected —
 * dedup happens in JS instead via `Set`, which is negligible cost for
 * a personal media library.
 */
export function useAvailableYears(): number[] | undefined {
  return useLiveQuery(async () => {
    const allYears = await db.mediaEntries.orderBy('completedYear').keys();
    const uniqueYears = Array.from(new Set(allYears as number[]));
    return uniqueYears.sort((a, b) => b - a);
  }, []);
}
