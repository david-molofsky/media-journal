import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';
import {
  recordImportCompleted,
  recordImportFailed,
  recordImportStarted,
  type ImportActivityMap,
} from './importActivityService';

describe('import activity history', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  async function history(): Promise<ImportActivityMap> {
    const record = await db.appSettings.get(SETTINGS_KEYS.importActivity);
    return (record?.value ?? {}) as ImportActivityMap;
  }

  it('records started, successful and failed imports per source', async () => {
    await recordImportStarted('trakt', 'api');
    expect((await history()).trakt).toMatchObject({ status: 'running', method: 'api' });

    await recordImportCompleted('trakt', 'api', { itemsImported: 14, itemsSkipped: 2 });
    const completed = (await history()).trakt;
    expect(completed).toMatchObject({
      status: 'success',
      itemsImported: 14,
    });
    expect(completed).not.toHaveProperty('lastError');

    await recordImportFailed('letterboxd', 'csv', 'parse');
    expect((await history()).letterboxd).toMatchObject({
      status: 'error',
      method: 'csv',
      lastError: 'Import failed during parse.',
    });
    expect((await history()).trakt?.status).toBe('success');
  });
});
