import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Returns a sorted list of every distinct `metadata.source` value that
 * exists across any entry in the library — e.g. "Netflix", "Audible",
 * "Libby". Powers the Source filter chip in Library. Mirrors
 * `useAvailableTags`: only values actually saved on an entry appear
 * here, not the full suggestion list offered on the entry form.
 * Updates reactively whenever an entry is added, edited or deleted.
 */
export function useAvailableSources(): string[] {
  return (
    useLiveQuery(async () => {
      const entries = await db.mediaEntries.toArray();
      const sourceSet = new Set<string>();
      for (const entry of entries) {
        const source = entry.metadata.source;
        if (typeof source === 'string' && source.trim()) {
          sourceSet.add(source);
        }
      }
      return Array.from(sourceSet).sort();
    }, []) ?? []
  );
}
