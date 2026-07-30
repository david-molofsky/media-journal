import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { getGoals } from '@/services/database/goalsService';
import { isDriveConnected } from '@/services/googleDrive/googleDriveService';

export interface GettingStartedStatus {
  hasEntry: boolean;
  hasDrive: boolean;
  hasWishlistItem: boolean;
  hasGoal: boolean;
}

/**
 * Adaptive completion state for the Dashboard "Getting started"
 * checklist (see chat — onboarding package). Each field reflects real
 * app state rather than a manually-ticked flag, so an existing user
 * with data already sees the matching rows pre-completed the first
 * time the card appears. Combined into one query (rather than
 * separate hooks) so the four checks share a single reactive
 * subscription.
 */
export function useGettingStartedStatus(): GettingStartedStatus | undefined {
  const year = dayjs().year();

  return useLiveQuery(async () => {
    const [entryCount, hasDrive, wishlistCount, goals] = await Promise.all([
      db.mediaEntries.count(),
      isDriveConnected(),
      db.mediaEntries.where('status').equals('wishlist').count(),
      getGoals(year),
    ]);

    return {
      hasEntry: entryCount > 0,
      hasDrive,
      hasWishlistItem: wishlistCount > 0,
      hasGoal: Object.values(goals).some((target) => target > 0),
    };
  }, [year]);
}
