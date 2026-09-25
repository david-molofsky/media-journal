import type { MediaEntry } from '@/models';

/** Keep completion date as the primary sort, then preserve logging order within a day. */
export function compareCompletionNewest(a: MediaEntry, b: MediaEntry): number {
  return (
    (b.completedDate ?? '').localeCompare(a.completedDate ?? '') ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function compareCompletionOldest(a: MediaEntry, b: MediaEntry): number {
  return (
    (a.completedDate ?? '').localeCompare(b.completedDate ?? '') ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
