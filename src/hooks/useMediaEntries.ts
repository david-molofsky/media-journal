import { useLiveQuery } from 'dexie-react-hooks';
import {
  listEntries,
  type EntryListFilter,
  type EntrySortOrder,
} from '@/services/database/entryService';
import type { MediaEntry } from '@/models';

/**
 * Reactive list of entries matching a filter/sort, automatically
 * re-running whenever the underlying `mediaEntries` table changes
 * (Technical Architecture Document, section 6: "Dexie live queries for
 * reactive data updates").
 *
 * Returns `undefined` while the initial query is in flight, and an
 * array thereafter — callers can use that to drive a loading state.
 */
export function useMediaEntries(
  filter: EntryListFilter = {},
  sort: EntrySortOrder = 'completedDateDesc',
): MediaEntry[] | undefined {
  return useLiveQuery(() => listEntries(filter, sort), [JSON.stringify(filter), sort]);
}
