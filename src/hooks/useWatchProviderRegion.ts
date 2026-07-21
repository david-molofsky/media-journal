import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/** Default matches the value that used to be hardcoded in
 * tmdbService.ts — existing users see no change until they actively
 * pick a different region in Settings. */
const DEFAULT_REGION = 'GB';

/** Returns the region code used for TMDB/JustWatch streaming lookups
 * (Settings > Region), updating reactively when the setting changes. */
export function useWatchProviderRegion(): string {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get('watchProviderRegion');
      return (record?.value as string) ?? DEFAULT_REGION;
    }, [], DEFAULT_REGION) ?? DEFAULT_REGION
  );
}
