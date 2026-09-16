import dayjs from 'dayjs';
import { SETTINGS_KEYS } from '@/models';
import {
  exportLibrary,
  importLibrary,
  inspectLibraryImport,
  type ImportPreview,
  type ExportPayload,
} from '@/services/importExport/importExportService';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { downloadJson } from '@/utils/downloadJson';
import { generateId } from '@/utils/id';
import {
  downloadCloudJournal,
  getCloudJournalManifest,
  replaceCloudJournal,
  uploadStartingJournal,
  type CloudJournalManifest,
} from './cloudJournalService';
import { calculateJournalHash, mergeJournalSnapshots } from './journalSync';

export interface LocalJournalSummary {
  entries: number;
  mediaTypes: number;
  podcastSubscriptions: number;
  settings: number;
}

export interface CloudJournalReview {
  manifest: CloudJournalManifest;
  snapshot: ExportPayload;
  preview: ImportPreview;
}

export type DeviceSyncOutcome = 'unchanged' | 'uploaded' | 'downloaded' | 'merged';

export async function getOrCreateSyncDeviceId(): Promise<string> {
  const existing = await getSetting<string | null>(SETTINGS_KEYS.syncDeviceId, null);
  if (existing) return existing;

  const deviceId = generateId();
  await setSetting(SETTINGS_KEYS.syncDeviceId, deviceId);
  return deviceId;
}

export async function createStartingJournalSnapshot(): Promise<ExportPayload> {
  return exportLibrary();
}

export function summariseJournal(snapshot: ExportPayload): LocalJournalSummary {
  return {
    entries: snapshot.entries.length,
    mediaTypes: snapshot.mediaTypes.length,
    podcastSubscriptions: snapshot.podcastSubscriptions.length,
    settings: Object.keys(snapshot.settings).length,
  };
}

export function downloadStartingJournalSafetyCopy(snapshot: ExportPayload): string {
  const filename = `media-journal-before-first-sync-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
  downloadJson(snapshot, filename);
  return filename;
}

export async function makeThisDeviceStartingJournal(
  userId: string,
  snapshot: ExportPayload,
): Promise<CloudJournalManifest> {
  const deviceId = await getOrCreateSyncDeviceId();
  const manifest = await uploadStartingJournal(userId, deviceId, snapshot);
  const journalHash = await calculateJournalHash(snapshot);
  await Promise.all([
    setSetting(SETTINGS_KEYS.syncProvider, 'firebase'),
    setSetting(SETTINGS_KEYS.syncUserId, userId),
    setSetting(SETTINGS_KEYS.lastDeviceSyncAt, manifest.completedAt),
    setSetting(SETTINGS_KEYS.lastCloudRevision, manifest.revision),
    setSetting(SETTINGS_KEYS.lastSyncedJournalHash, journalHash),
    setSetting(SETTINGS_KEYS.lastDeviceSyncError, null),
  ]);
  return manifest;
}

export async function reviewCloudJournal(userId: string): Promise<CloudJournalReview> {
  const cloud = await downloadCloudJournal(userId);
  return {
    ...cloud,
    preview: await inspectLibraryImport(cloud.snapshot),
  };
}

async function markSynced(
  userId: string,
  manifest: CloudJournalManifest,
  journalHash: string,
) {
  await Promise.all([
    setSetting(SETTINGS_KEYS.syncProvider, 'firebase'),
    setSetting(SETTINGS_KEYS.syncUserId, userId),
    setSetting(SETTINGS_KEYS.lastDeviceSyncAt, manifest.completedAt),
    setSetting(SETTINGS_KEYS.lastCloudRevision, manifest.revision),
    setSetting(SETTINGS_KEYS.lastSyncedJournalHash, journalHash),
    setSetting(SETTINGS_KEYS.lastDeviceSyncError, null),
  ]);
}

export async function adoptCloudJournalOnDevice(
  userId: string,
  review: CloudJournalReview,
): Promise<void> {
  const local = await exportLibrary();
  downloadStartingJournalSafetyCopy(local);
  await importLibrary(review.snapshot, 'replace');
  await markSynced(userId, review.manifest, await calculateJournalHash(review.snapshot));
}

export async function combineThisDeviceWithCloud(
  userId: string,
  review: CloudJournalReview,
): Promise<CloudJournalManifest> {
  const local = await exportLibrary();
  downloadStartingJournalSafetyCopy(local);
  const merged = mergeJournalSnapshots(review.snapshot, local);
  await importLibrary(merged, 'replace');
  const manifest = await replaceCloudJournal(
    userId,
    await getOrCreateSyncDeviceId(),
    merged,
    review.manifest.revision,
  );
  await markSynced(userId, manifest, await calculateJournalHash(merged));
  return manifest;
}

/**
 * Reconciles an enrolled device. Cloud-only changes are downloaded, local-only
 * changes are uploaded, and simultaneous changes are merged without dropping
 * unique records from either side.
 */
export async function syncDeviceNow(userId: string): Promise<DeviceSyncOutcome> {
  try {
    const [local, lastRevision, lastHash, currentManifest, deviceId] = await Promise.all([
      exportLibrary(),
      getSetting<number | null>(SETTINGS_KEYS.lastCloudRevision, null),
      getSetting<string | null>(SETTINGS_KEYS.lastSyncedJournalHash, null),
      getCloudJournalManifest(userId),
      getOrCreateSyncDeviceId(),
    ]);

    if (
      currentManifest?.status === 'syncing' &&
      currentManifest.sourceDeviceId === deviceId &&
      currentManifest.baseRevision !== undefined
    ) {
      const recovered = await replaceCloudJournal(
        userId,
        deviceId,
        local,
        currentManifest.baseRevision,
      );
      const recoveredHash = await calculateJournalHash(local);
      await markSynced(userId, recovered, recoveredHash);
      return 'uploaded';
    }

    const cloud = await downloadCloudJournal(userId);
    const localHash = await calculateJournalHash(local);
    const cloudHash = cloud.manifest.journalHash;
    const localChanged = lastHash !== null && localHash !== lastHash;
    const cloudChanged =
      lastRevision !== null &&
      (cloud.manifest.revision !== lastRevision || cloudHash !== lastHash);

    if (lastHash === null || lastRevision === null) {
      throw new Error('Review the cloud journal before enabling sync on this device.');
    }

    if (!localChanged && !cloudChanged) {
      await markSynced(userId, cloud.manifest, cloudHash);
      return 'unchanged';
    }

    if (cloudChanged && !localChanged) {
      await importLibrary(cloud.snapshot, 'replace');
      await markSynced(userId, cloud.manifest, cloudHash);
      return 'downloaded';
    }

    if (localChanged && !cloudChanged) {
      const manifest = await replaceCloudJournal(
        userId,
        deviceId,
        local,
        cloud.manifest.revision,
      );
      await markSynced(userId, manifest, localHash);
      return 'uploaded';
    }

    const merged = mergeJournalSnapshots(cloud.snapshot, local);
    await importLibrary(merged, 'replace');
    const manifest = await replaceCloudJournal(
      userId,
      deviceId,
      merged,
      cloud.manifest.revision,
    );
    await markSynced(userId, manifest, await calculateJournalHash(merged));
    return 'merged';
  } catch (error) {
    await setSetting(
      SETTINGS_KEYS.lastDeviceSyncError,
      error instanceof Error ? error.message : 'Device sync failed.',
    );
    throw error;
  }
}
