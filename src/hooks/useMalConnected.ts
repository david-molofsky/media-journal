import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/** Whether MyAnimeList is currently connected (has a stored access
 * token), updating reactively on connect/disconnect. */
export function useMalConnected(): boolean {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get('malAccessToken');
      return !!record?.value;
    }, [], false) ?? false
  );
}
