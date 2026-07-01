import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Returns a sorted list of every distinct tag that exists across any
 * entry in the library. Used to power the tag autocomplete in
 * EntryForm and the tag filter chip in the Library. Updates reactively
 * whenever an entry is added, edited or deleted.
 */
export function useAvailableTags(): string[] {
  return (
    useLiveQuery(async () => {
      const entries = await db.mediaEntries.toArray();
      const tagSet = new Set<string>();
      for (const entry of entries) {
        for (const tag of entry.tags ?? []) {
          tagSet.add(tag);
        }
      }
      return Array.from(tagSet).sort();
    }, []) ?? []
  );
}
