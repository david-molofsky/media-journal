import { db } from './db';
import { SETTINGS_KEYS } from '@/models';
import { generateId } from '@/utils/id';

export interface EntryDeletionEvent {
  id: string;
  eventId: string;
  undone: boolean;
}

export function entryDeletionEventsFrom(value: unknown): EntryDeletionEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (event): event is EntryDeletionEvent =>
      typeof event === 'object' &&
      event !== null &&
      typeof event.id === 'string' &&
      event.id.length > 0 &&
      typeof event.eventId === 'string' &&
      event.eventId.length > 0 &&
      typeof event.undone === 'boolean',
  );
}

/** Call inside a transaction covering mediaEntries and appSettings. */
export async function recordEntryDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const key = SETTINGS_KEYS.entryDeletionEvents;
  const existing = entryDeletionEventsFrom((await db.appSettings.get(key))?.value);
  await db.appSettings.put({
    key,
    value: [
      ...existing,
      ...ids.map((id) => ({ id, eventId: generateId(), undone: false })),
    ],
  });
}

/** Undo revives the original IDs, so it must remove their deletion records. */
export async function clearEntryDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const key = SETTINGS_KEYS.entryDeletionEvents;
  const existing = entryDeletionEventsFrom((await db.appSettings.get(key))?.value);
  const restored = new Set(ids);
  await db.appSettings.put({
    key,
    value: existing.map((event) =>
      restored.has(event.id) ? { ...event, undone: true } : event,
    ),
  });
}
