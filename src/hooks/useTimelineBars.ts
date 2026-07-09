import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { packTimelineBars, type TimelineBar } from '@/utils/timelinePacking';

/**
 * All completed entries (all-time, not year-scoped — the Timeline page
 * scrolls freely across years rather than filtering by one), packed
 * into rows. Only `status === 'completed'` entries are included,
 * matching every other statistics view; in_progress/wishlist entries
 * have no reliable date range to place on a timeline.
 */
export function useTimelineBars(): TimelineBar[] | undefined {
  return useLiveQuery(async () => {
    const entries = await db.mediaEntries.where('status').equals('completed').toArray();
    return packTimelineBars(entries);
  }, []);
}
