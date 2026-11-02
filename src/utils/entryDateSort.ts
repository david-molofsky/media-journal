import type { MediaEntry } from '@/models';

/** Sort by the completion date, then the exact instant the entry was marked complete.
 * Legacy entries without completedAt fall back to createdAt. */
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
