import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Returns a sorted list of every distinct genre that exists across any
 * entry in the library. Used to power the genre autocomplete in
 * EntryForm and the Genre filter chip in the Library. Mirrors
 * `useAvailableTags`. Updates reactively whenever an entry is added,
 * edited or deleted.
 */
export function useAvailableGenres(): string[] {
  return (
    useLiveQuery(async () => {
      const entries = await db.mediaEntries.toArray();
      const genreSet = new Set<string>();
      for (const entry of entries) {
        for (const genre of entry.genres ?? []) {
          genreSet.add(genre);
        }
      }
      return Array.from(genreSet).sort();
    }, []) ?? []
  );
}
