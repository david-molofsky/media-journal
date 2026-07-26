import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { setSetting } from '@/services/database/settingsService';
import type { SettingsKey } from '@/models';

/**
 * Returns a persisted number setting plus a setter, updating reactively
 * (same pattern as useBooleanSetting). Used for the Add Entry "more
 * media types" tip card's per-device shown-count (see chat), so it
 * survives PWA restarts and stays in sync between the media-type grid
 * and the entry-save handler that also increments it.
 */
export function useNumberSetting(
  key: SettingsKey,
  fallback: number,
): [number, (value: number) => void] {
  const value =
    useLiveQuery(async () => {
      const record = await db.appSettings.get(key);
      return (record?.value as number) ?? fallback;
    }, [key], fallback) ?? fallback;

  const setValue = (next: number) => {
    void setSetting(key, next);
  };

  return [value, setValue];
}
