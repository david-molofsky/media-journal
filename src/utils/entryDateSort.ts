import type { MediaEntry } from '@/models';

/** Keep completion dates chronological; within the same date, use the exact
 * instant the entry was marked complete. Legacy entries fall back to createdAt. */
export function compareCompletionNewest(a: MediaEntry, b: MediaEntry): number {
  return (
    (b.completedDate ?? '').localeCompare(a.completedDate ?? '') ||
    (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function compareCompletionOldest(a: MediaEntry, b: MediaEntry): number {
  return (
    (a.completedDate ?? '').localeCompare(b.completedDate ?? '') ||
    (a.completedAt ?? a.createdAt).localeCompare(b.completedAt ?? b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
