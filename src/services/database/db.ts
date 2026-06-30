import Dexie, { type Table } from 'dexie';

/**
 * Media Journal's IndexedDB database, accessed via Dexie.
 *
 * This is intentionally a minimal connection stub for Milestone 1. The
 * full schema — `mediaEntries`, `mediaTypes` and `appSettings` tables,
 * indexes and models — is defined in Milestone 2, per the Database
 * Schema & Data Model document.
 */
export class MediaJournalDatabase extends Dexie {
  constructor() {
    super('MediaJournalDatabase');
  }
}

export const db = new MediaJournalDatabase();

// Re-exported for convenience once tables are introduced in Milestone 2.
export type { Table };
