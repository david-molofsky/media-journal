import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';

/** Whether Audiobookshelf is currently connected (has a stored
 * token), updating reactively on connect/disconnect. Mirrors
 * useTraktConnected/useMalConnected. */
export function useAudiobookshelfConnected(): boolean {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get(SETTINGS_KEYS.absToken);
      return !!record?.value;
    }, [], false) ?? false
  );
}
