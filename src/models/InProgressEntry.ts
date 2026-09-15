import type { EntryMetadata } from './MediaEntry';

/**
 * Legacy input shape retained for the dedicated In Progress screen.
 * Since database version 6 these values are stored as `MediaEntry`
 * records with `status: 'in_progress'`, not in a separate table.
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
