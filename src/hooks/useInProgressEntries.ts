import { useLiveQuery } from 'dexie-react-hooks';
import { listEntries } from '@/services/database/entryService';
import type { MediaEntry } from '@/models';

/** Reactive list of in-progress entries, newest first by date added.
 * Now queries `mediaEntries` with `status: 'in_progress'` following
 * the v6 migration that retired the separate `inProgressEntries` table. */
export function useInProgressEntries(): MediaEntry[] | undefined {
  return useLiveQuery(
    () => listEntries({ status: 'in_progress' }, 'createdAtDesc'),
    [],
  );
}
