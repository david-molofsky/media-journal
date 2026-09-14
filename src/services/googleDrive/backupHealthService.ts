import { SETTINGS_KEYS } from '@/models';
import { setSetting } from '@/services/database/settingsService';

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export function automaticBackupErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Automatic backup could not connect to Google Drive.';
}

export function isAutomaticBackupStale(lastSuccessfulAt: string | null): boolean {
  if (!lastSuccessfulAt) return true;
  const timestamp = Date.parse(lastSuccessfulAt);
  return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_AFTER_MS;
}

export async function recordAutomaticBackupSuccess(): Promise<void> {
  await Promise.all([
    setSetting(SETTINGS_KEYS.lastAutoBackupAt, new Date().toISOString()),
    setSetting(SETTINGS_KEYS.lastAutoBackupError, null),
  ]);
}

export async function recordAutomaticBackupFailure(error: unknown): Promise<string> {
  const message = automaticBackupErrorMessage(error);
  await setSetting(SETTINGS_KEYS.lastAutoBackupError, message);
  return message;
}

export async function clearAutomaticBackupFailure(): Promise<void> {
  await setSetting(SETTINGS_KEYS.lastAutoBackupError, null);
}
