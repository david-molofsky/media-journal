import { db } from './db';
import type { SettingsKey } from '@/models';

/** Reads a setting, returning `fallback` if it has never been set. */
export async function getSetting<T>(key: SettingsKey, fallback: T): Promise<T> {
  const record = await db.appSettings.get(key);
  return record ? (record.value as T) : fallback;
}

/** Writes a setting, creating or overwriting it. */
export async function setSetting<T>(key: SettingsKey, value: T): Promise<void> {
  await db.appSettings.put({ key, value });
}
