import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/** Whether Trakt is currently connected (has a stored access token),
 * updating reactively on connect/disconnect. Mirrors useMalConnected. */
export function useTraktConnected(): boolean {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get('traktAccessToken');
      return !!record?.value;
    }, [], false) ?? false
  );
}
