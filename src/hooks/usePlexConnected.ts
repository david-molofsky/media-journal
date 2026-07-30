import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';

/** Whether Plex is currently connected (has a stored token), updating
 * reactively on connect/disconnect. */
export function usePlexConnected(): boolean {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get(SETTINGS_KEYS.plexToken);
      return !!record?.value;
    }, [], false) ?? false
  );
}
