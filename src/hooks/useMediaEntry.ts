import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import type { MediaEntry } from '@/models';

/** Reactive single-entry lookup, used by the Edit Entry screen
 * (Milestone 3). Returns `undefined` while loading or if the id
 * doesn't exist — callers should treat both the same way (show a
 * "not found" state) once loading has settled. */
export function useMediaEntry(id: string | undefined): MediaEntry | undefined {
  return useLiveQuery(() => (id ? db.mediaEntries.get(id) : undefined), [id]);
}
