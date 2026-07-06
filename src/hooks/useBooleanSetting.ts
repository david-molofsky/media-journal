import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { setSetting } from '@/services/database/settingsService';
import type { SettingsKey } from '@/models';

/**
 * Returns a persisted boolean setting plus a setter, updating reactively
 * (same pattern as useColorMode). Used for the Metadata auto-fill
 * toggles in Settings, so each one survives PWA restarts and applies to
 * every future auto-fill rather than resetting per import.
 */
export function useBooleanSetting(
  key: SettingsKey,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const value =
    useLiveQuery(async () => {
      const record = await db.appSettings.get(key);
      return (record?.value as boolean) ?? fallback;
    }, [key], fallback) ?? fallback;

  const setValue = (next: boolean) => {
    void setSetting(key, next);
  };

  return [value, setValue];
}
