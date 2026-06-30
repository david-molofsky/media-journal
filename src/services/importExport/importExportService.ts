import { z } from 'zod';
import { db } from '@/services/database/db';
import { getMetadataSchema } from '@/services/validation/entrySchemas';
import { SETTINGS_KEYS, type SettingsKey } from '@/models';
import type { EntryMetadata, MediaEntry } from '@/models';
import { nowIso } from '@/utils/dateUtils';

const EXPORT_VERSION = 1;

export interface ExportPayload {
  version: number;
  exportedAt: string;
  entries: MediaEntry[];
  settings: Record<string, unknown>;
}

/**
 * Builds the complete export payload (PRD section 5: "Export their
 * complete library as JSON"; Database Schema & Data Model, section
 * 11). This is the application's backup mechanism, so it intentionally
 * exports everything — entries and settings — rather than a partial
 * view.
 */
export async function exportLibrary(): Promise<ExportPayload> {
  const [entries, settingRecords] = await Promise.all([
    db.mediaEntries.toArray(),
    db.appSettings.toArray(),
  ]);
  const settings = Object.fromEntries(settingRecords.map((record) => [record.key, record.value]));
  return { version: EXPORT_VERSION, exportedAt: nowIso(), entries, settings };
}

/** Shape of a single entry inside an export file — the full
 * `MediaEntry` shape (unlike `mediaEntrySchema`, which validates a
 * *new* entry before id/timestamps exist). */
const importedEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(250),
  mediaType: z.string().min(1),
  startedDate: z.string().optional(),
  completedDate: z.string().min(1),
  rating: z.number().min(0).max(10).optional(),
  notes: z.string().max(5000).optional(),
  repeatConsumption: z.boolean(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.undefined()])),
  completedYear: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Top-level export file shape. Deliberately loose on `entries` (kept
 * as `unknown[]` here) so a structurally-valid file with some
 * malformed entries can still be partially imported, per Database
 * Schema & Data Model section 11: "Ignore unsupported fields... Reject
 * malformed files" — malformed at the file level is rejected outright;
 * malformed at the entry level is skipped and reported. */
const exportFileSchema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  entries: z.array(z.unknown()),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Validates and imports a previously exported JSON payload (PRD
 * section 5: "Import a previously exported JSON file"). IDs are
 * preserved via `bulkPut`, so re-importing the same file is
 * idempotent and importing a newer export of the same library
 * overwrites matching entries rather than duplicating them.
 */
export async function importLibrary(raw: unknown): Promise<ImportResult> {
  const file = exportFileSchema.safeParse(raw);
  if (!file.success) {
    throw new Error("This file doesn't look like a Media Journal export.");
  }

  let skipped = 0;
  const validEntries: MediaEntry[] = [];

  for (const candidate of file.data.entries) {
    const entryResult = importedEntrySchema.safeParse(candidate);
    if (!entryResult.success) {
      skipped += 1;
      continue;
    }
    const metadataResult = getMetadataSchema(entryResult.data.mediaType).safeParse(
      entryResult.data.metadata,
    );
    if (!metadataResult.success) {
      skipped += 1;
      continue;
    }
    validEntries.push({ ...entryResult.data, metadata: metadataResult.data as EntryMetadata });
  }

  await db.mediaEntries.bulkPut(validEntries);

  if (file.data.settings) {
    const knownKeys = Object.values(SETTINGS_KEYS) as SettingsKey[];
    const updates = knownKeys
      .filter((key) => key in (file.data.settings ?? {}))
      .map((key) => ({ key, value: file.data.settings![key] }));
    if (updates.length > 0) {
      await db.appSettings.bulkPut(updates);
    }
  }

  return { imported: validEntries.length, skipped };
}
