import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import type { TvTrackingMode } from '@/models';

/**
 * Returns the current TV tracking mode, updating reactively whenever
 * the setting changes (e.g. the user toggles it in Settings while
 * the Add Entry form is open). Defaults to `'season'` on first use or
 * when the setting has never been written.
 */
export function useTvTrackingMode(): TvTrackingMode {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get('tvTrackingMode');
      return (record?.value as TvTrackingMode) ?? 'season';
    }, [], 'season') ?? 'season'
  );
}
