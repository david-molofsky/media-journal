import { z } from 'zod';
import { db } from '@/services/database/db';
import { getMetadataSchema } from '@/services/validation/entrySchemas';
import { SETTINGS_KEYS, type SettingsKey } from '@/models';
import type {
  EntryMetadata,
  MediaEntry,
  MediaType,
  PodcastSubscription,
} from '@/models';
import { nowIso } from '@/utils/dateUtils';

const EXPORT_VERSION = 2;

/**
 * Only settings that describe the journal itself belong in a portable
 * backup. Connection credentials, server addresses, OAuth tokens,
 * automatic-backup state and first-run UI flags deliberately stay on
 * the device that created them.
 *
 * This is an allowlist rather than a blocklist so a future credential
 * cannot accidentally start appearing in backup files merely because
 * a new setting key was added.
 */
const EXPORTABLE_SETTINGS_KEYS: readonly SettingsKey[] = [
  SETTINGS_KEYS.selectedTheme,
  SETTINGS_KEYS.lastViewedYear,
  SETTINGS_KEYS.importExportVersion,
  SETTINGS_KEYS.tvTrackingMode,
  SETTINGS_KEYS.colorMode,
  SETTINGS_KEYS.lastLibraryStatusTab,
  SETTINGS_KEYS.autofillOverview,
  SETTINGS_KEYS.autofillRuntime,
  SETTINGS_KEYS.autofillProductionCompany,
  SETTINGS_KEYS.autofillTvStatus,
  SETTINGS_KEYS.autofillSeries,
  SETTINGS_KEYS.autofillPoster,
  SETTINGS_KEYS.autofillReleaseDate,
  SETTINGS_KEYS.autofillImdbLink,
  SETTINGS_KEYS.autofillComicPublisher,
  SETTINGS_KEYS.autofillComicIssueTitle,
  SETTINGS_KEYS.autofillComicCoverDate,
  SETTINGS_KEYS.autofillComicWriter,
  SETTINGS_KEYS.autofillComicPenciller,
  SETTINGS_KEYS.autofillComicInker,
  SETTINGS_KEYS.autofillComicColorist,
  SETTINGS_KEYS.autofillComicLetterer,
  SETTINGS_KEYS.autofillComicCoverArtist,
  SETTINGS_KEYS.autofillComicEditor,
  SETTINGS_KEYS.autofillComicCoverImage,
  SETTINGS_KEYS.autofillBookCoverImage,
  SETTINGS_KEYS.autofillBookReleaseYear,
  SETTINGS_KEYS.watchProviderRegion,
  SETTINGS_KEYS.subscriptionSources,
  SETTINGS_KEYS.subscriptionTierSelections,
  SETTINGS_KEYS.subscriptionPriceOverrides,
  SETTINGS_KEYS.subscriptionBillingCycle,
  SETTINGS_KEYS.subscriptionAnnualPrices,
  SETTINGS_KEYS.yearlyGoals,
];

const EXPORTABLE_SETTINGS_KEY_SET = new Set<string>(EXPORTABLE_SETTINGS_KEYS);

export interface ExportPayload {
  version: number;
  exportedAt: string;
  entries: MediaEntry[];
  mediaTypes: MediaType[];
  podcastSubscriptions: PodcastSubscription[];
  settings: Record<string, unknown>;
}

export type RestoreMode = 'merge' | 'replace';

export interface ImportPreview {
  version: number;
  exportedAt?: string;
  entryCount: number;
  mediaTypeCount: number;
  podcastSubscriptionCount: number;
  settingCount: number;
  skippedEntryCount: number;
  legacy: boolean;
  canReplace: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  mediaTypesImported: number;
  podcastSubscriptionsImported: number;
  settingsImported: number;
  mode: RestoreMode;
}

/**
 * Builds a complete, portable backup. Credentials and device-local
 * behaviour are excluded, while all journal-owned IndexedDB tables are
 * included.
 */
export async function exportLibrary(): Promise<ExportPayload> {
  const [entries, mediaTypes, podcastSubscriptions, settingRecords] =
    await Promise.all([
      db.mediaEntries.toArray(),
      db.mediaTypes.toArray(),
      db.podcastSubscriptions.toArray(),
      db.appSettings.toArray(),
    ]);

  const settings = Object.fromEntries(
    settingRecords
      .filter((record) => EXPORTABLE_SETTINGS_KEY_SET.has(record.key))
      .map((record) => [record.key, record.value]),
  );

  return {
    version: EXPORT_VERSION,
    exportedAt: nowIso(),
    entries,
    mediaTypes,
    podcastSubscriptions,
    settings,
  };
}

const metadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.undefined(),
]);

const importedEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(250),
  mediaType: z.string().min(1),
  status: z.enum(['completed', 'in_progress', 'wishlist']).default('completed'),
  startedDate: z.string().optional(),
  completedDate: z.string().optional(),
  rating: z.number().min(0).max(10).optional(),
  notes: z.string().max(5000).optional(),
  repeatConsumption: z.boolean(),
  tags: z.array(z.string()).default([]),
  genres: z.array(z.string()).default([]),
  watchedWith: z.array(z.string()).default([]),
  recommendedBy: z.array(z.string()).default([]),
  wishlistOrder: z.number().optional(),
  metadata: z.record(z.string(), metadataValueSchema),
  completedYear: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const fieldDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'autocomplete']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const mediaTypeSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  icon: z.string().min(1),
  colour: z.string().min(1),
  enabled: z.boolean(),
  fields: z.array(fieldDefinitionSchema),
});

const podcastSubscriptionSchema = z.object({
  id: z.string().min(1),
  feedUrl: z.string().min(1),
  showTitle: z.string().min(1),
  showArtworkUrl: z.string().optional(),
  lastCheckedAt: z.string().optional(),
  createdAt: z.string(),
});

const versionOneSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  entries: z.array(z.unknown()),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const versionTwoSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string().optional(),
  entries: z.array(z.unknown()),
  mediaTypes: z.array(mediaTypeSchema).min(1),
  podcastSubscriptions: z.array(podcastSubscriptionSchema),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const exportFileSchema = z.discriminatedUnion('version', [
  versionOneSchema,
  versionTwoSchema,
]);

interface PreparedImport {
  version: number;
  exportedAt?: string;
  entries: MediaEntry[];
  mediaTypes: MediaType[];
  podcastSubscriptions: PodcastSubscription[];
  settings: Record<string, unknown>;
  skipped: number;
  legacy: boolean;
  canReplace: boolean;
}

function prepareImport(raw: unknown): PreparedImport {
  const file = exportFileSchema.safeParse(raw);

  if (!file.success) {
    const suppliedVersion =
      typeof raw === 'object' && raw !== null && 'version' in raw
        ? (raw as { version?: unknown }).version
        : undefined;

    if (typeof suppliedVersion === 'number' && suppliedVersion > EXPORT_VERSION) {
      throw new Error(
        'This backup was created by a newer version of Media Journal. Update the app before restoring it.',
      );
    }

    throw new Error("This file doesn't look like a supported Media Journal backup.");
  }

  const entries: MediaEntry[] = [];
  let skipped = 0;

  for (const candidate of file.data.entries) {
    const entryResult = importedEntrySchema.safeParse(candidate);
    if (!entryResult.success) {
      skipped += 1;
      continue;
    }

    const metadataResult = getMetadataSchema(
      entryResult.data.mediaType,
    ).safeParse(entryResult.data.metadata);

    if (!metadataResult.success) {
      skipped += 1;
      continue;
    }

    entries.push({
      ...entryResult.data,
      metadata: metadataResult.data as EntryMetadata,
    });
  }

  const settings = Object.fromEntries(
    Object.entries(file.data.settings ?? {}).filter(([key]) =>
      EXPORTABLE_SETTINGS_KEY_SET.has(key),
    ),
  );

  const legacy = file.data.version === 1;
  const mediaTypes =
    file.data.version === 2 ? (file.data.mediaTypes as MediaType[]) : [];
  const podcastSubscriptions =
    file.data.version === 2
      ? (file.data.podcastSubscriptions as PodcastSubscription[])
      : [];

  return {
    version: file.data.version,
    exportedAt: file.data.exportedAt,
    entries,
    mediaTypes,
    podcastSubscriptions,
    settings,
    skipped,
    legacy,
    // A v1 backup is incomplete by definition. A backup containing
    // invalid entries must not be allowed to replace good local data.
    canReplace: !legacy && skipped === 0,
  };
}

/** Validates a backup without changing the database. */
export function inspectLibraryImport(raw: unknown): ImportPreview {
  const prepared = prepareImport(raw);

  return {
    version: prepared.version,
    exportedAt: prepared.exportedAt,
    entryCount: prepared.entries.length,
    mediaTypeCount: prepared.mediaTypes.length,
    podcastSubscriptionCount: prepared.podcastSubscriptions.length,
    settingCount: Object.keys(prepared.settings).length,
    skippedEntryCount: prepared.skipped,
    legacy: prepared.legacy,
    canReplace: prepared.canReplace,
  };
}

/**
 * Restores a validated backup as one IndexedDB transaction.
 *
 * Merge updates matching IDs and keeps unrelated local records.
 * Replace recreates the portable journal state exactly, while leaving
 * credentials and device-only settings untouched.
 */
export async function importLibrary(
  raw: unknown,
  mode: RestoreMode = 'merge',
): Promise<ImportResult> {
  const prepared = prepareImport(raw);

  if (mode === 'replace' && !prepared.canReplace) {
    throw new Error(
      prepared.legacy
        ? 'Version 1 backups can only be merged because they do not contain all journal data.'
        : 'This backup contains invalid entries and cannot safely replace the current journal.',
    );
  }

  await db.transaction(
    'rw',
    [db.mediaEntries, db.mediaTypes, db.podcastSubscriptions, db.appSettings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.mediaEntries.clear(),
          db.mediaTypes.clear(),
          db.podcastSubscriptions.clear(),
          db.appSettings.bulkDelete([...EXPORTABLE_SETTINGS_KEYS]),
        ]);
      }

      if (prepared.entries.length > 0) {
        await db.mediaEntries.bulkPut(prepared.entries);
      }

      if (prepared.mediaTypes.length > 0) {
        await db.mediaTypes.bulkPut(prepared.mediaTypes);
      }

      if (prepared.podcastSubscriptions.length > 0) {
        await db.podcastSubscriptions.bulkPut(prepared.podcastSubscriptions);
      }

      const settingRecords = Object.entries(prepared.settings).map(([key, value]) => ({
        key,
        value,
      }));

      if (settingRecords.length > 0) {
        await db.appSettings.bulkPut(settingRecords);
      }
    },
  );

  return {
    imported: prepared.entries.length,
    skipped: prepared.skipped,
    mediaTypesImported: prepared.mediaTypes.length,
    podcastSubscriptionsImported: prepared.podcastSubscriptions.length,
    settingsImported: Object.keys(prepared.settings).length,
    mode,
  };
}
