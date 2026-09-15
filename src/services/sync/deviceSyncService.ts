import dayjs from 'dayjs';
import { SETTINGS_KEYS } from '@/models';
import {
  exportLibrary,
  type ExportPayload,
} from '@/services/importExport/importExportService';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { downloadJson } from '@/utils/downloadJson';
import { generateId } from '@/utils/id';
import { uploadStartingJournal, type CloudJournalManifest } from './cloudJournalService';

export interface LocalJournalSummary {
  entries: number;
  mediaTypes: number;
  podcastSubscriptions: number;
  settings: number;
}

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
  await Promise.all([
    setSetting(SETTINGS_KEYS.syncProvider, 'firebase'),
    setSetting(SETTINGS_KEYS.lastDeviceSyncAt, manifest.completedAt),
  ]);
  return manifest;
}
