import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Distinct years that have at least one entry, newest first — used to
 * populate the Library year filter (UI & UX Specification, section 5)
 * without hard-coding a year range. Reads directly off the indexed
 * `completedYear` field via `uniqueKeys()` rather than scanning the
 * whole table.
 */
export function useAvailableYears(): number[] | undefined {
  return useLiveQuery(async () => {
    const years = await db.mediaEntries.orderBy('completedYear').uniqueKeys();
    return (years as number[]).slice().sort((a, b) => b - a);
  }, []);
}
