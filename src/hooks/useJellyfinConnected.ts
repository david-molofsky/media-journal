import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';

/** Whether Jellyfin is currently connected (has a stored token),
 * updating reactively on connect/disconnect. */
export function useJellyfinConnected(): boolean {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get(SETTINGS_KEYS.jellyfinToken);
      return !!record?.value;
    }, [], false) ?? false
  );
}
