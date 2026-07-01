import type { EntryMetadata } from './MediaEntry';

/**
 * An in-progress item — something the user has started but not yet
 * finished. Lives in its own `inProgressEntries` table so the
 * `mediaEntries` statistics queries stay unaffected by incomplete data.
 * On "Mark as finished", a full `MediaEntry` is created from this data
 * and the in-progress record is deleted.
 */
export interface InProgressEntry {
  id: string;
  title: string;
  mediaType: string;
  startedDate?: string;
  notes?: string;
  metadata: EntryMetadata;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type NewInProgressInput = Omit<InProgressEntry, 'id' | 'createdAt' | 'updatedAt'>;
