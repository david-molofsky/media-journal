import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import type { MediaEntry } from '@/models';

export type TimelineEntry = Pick<
  MediaEntry,
  'id' | 'title' | 'mediaType' | 'status' | 'startedDate' | 'completedDate'
>;

/**
 * All completed AND in-progress entries (all-time, not year-scoped —
 * the Timeline page scrolls freely across years rather than filtering
 * by one), unpacked. In-progress entries render as running from their
 * start date to today (see timelinePacking.ts) — wishlist entries
 * still have no reliable date range and stay excluded.
 *
 * Deliberately NOT packed into rows here — TimelinePage packs via
 * packTimelineBars after applying the media-type filter, so that
 * filtering out a type re-packs the remaining bars tighter rather than
 * leaving gaps where the filtered rows used to be (see chat).
 */
export function useTimelineEntries(): TimelineEntry[] | undefined {
  return useLiveQuery(async () => {
    return db.mediaEntries.where('status').anyOf(['completed', 'in_progress']).toArray();
  }, []);
}
