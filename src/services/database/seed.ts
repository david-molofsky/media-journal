import { db } from './db';
import { defaultMediaTypes } from './defaultMediaTypes';

let seeded = false;

/**
 * Ensures the `mediaTypes` table is populated on first run.
 *
 * Safe to call multiple times — it only writes if the table is empty,
 * so it won't overwrite media types the user has since edited in
 * Settings (Milestone 7). Called once from App on startup.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  if (seeded) return;

  const existingCount = await db.mediaTypes.count();
  if (existingCount === 0) {
    await db.mediaTypes.bulkAdd(defaultMediaTypes);
  }

  seeded = true;
}
