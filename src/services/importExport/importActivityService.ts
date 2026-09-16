import { SETTINGS_KEYS } from '@/models';
import { getSetting, setSetting } from '@/services/database/settingsService';
import type {
  ImportMethod,
  ImportResultAnalytics,
  ImportSource,
} from '@/services/analytics/importAnalytics';

export type ImportActivityStatus = 'running' | 'success' | 'error';

export interface ImportActivityRecord {
  source: ImportSource;
  method: ImportMethod;
  status: ImportActivityStatus;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  itemsImported?: number;
  lastError?: string;
}

export type ImportActivityMap = Partial<Record<ImportSource, ImportActivityRecord>>;

async function updateActivity(
  source: ImportSource,
  update: (current: ImportActivityRecord | undefined) => ImportActivityRecord,
): Promise<void> {
  const history = await getSetting<ImportActivityMap>(SETTINGS_KEYS.importActivity, {});
  await setSetting(SETTINGS_KEYS.importActivity, {
    ...history,
    [source]: update(history[source]),
  });
}

export function recordImportStarted(
  source: ImportSource,
  method: ImportMethod,
): Promise<void> {
  return updateActivity(source, (current) => ({
    ...current,
    source,
    method,
    status: 'running',
    lastAttemptAt: new Date().toISOString(),
    lastError: undefined,
  }));
}

export function recordImportCompleted(
  source: ImportSource,
  method: ImportMethod,
  result: ImportResultAnalytics,
): Promise<void> {
  const now = new Date().toISOString();
  return updateActivity(source, () => ({
    source,
    method,
    status: 'success',
    lastAttemptAt: now,
    lastSuccessAt: now,
    itemsImported: result.itemsImported,
  }));
}

export function recordImportFailed(
  source: ImportSource,
  method: ImportMethod,
  stage: string,
): Promise<void> {
  return updateActivity(source, (current) => ({
    ...current,
    source,
    method,
    status: 'error',
    lastAttemptAt: new Date().toISOString(),
    lastError: `Import failed during ${stage}.`,
  }));
}
