import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import type { ColorMode } from '@/models';

/**
 * Returns the user's preferred colour mode, updating reactively when
 * the setting changes (e.g. they toggle dark mode in Settings while
 * another tab is open). Defaults to `'dark'` on first use — a user who
 * has never touched the Settings toggle sees dark mode; once they set
 * an explicit preference there, that stored value always wins.
 */
export function useColorMode(): ColorMode {
  return (
    useLiveQuery(async () => {
      const record = await db.appSettings.get('colorMode');
      return (record?.value as ColorMode) ?? 'dark';
    }, [], 'dark') ?? 'dark'
  );
}
