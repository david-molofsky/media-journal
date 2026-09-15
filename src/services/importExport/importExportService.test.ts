import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_KEYS } from '@/models';
import { db } from '@/services/database/db';
import { storedEntry } from '@/test/factories';
import {
  exportLibrary,
  importLibrary,
  inspectLibraryImport,
} from './importExportService';

const customMediaType = {
  id: 'board-game',
  displayName: 'Board Game',
  icon: 'Casino',
  colour: '#123456',
  enabled: true,
  fields: [
    { key: 'designer', label: 'Designer', type: 'text' as const, required: false },
  ],
};

const podcastSubscription = {
  id: 'podcast-1',
  feedUrl: 'https://example.com/feed.xml',
  showTitle: 'Example Show',
  createdAt: '2026-09-15T09:00:00.000Z',
};

describe('complete backup and safe restore', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it('round-trips journal data while excluding credentials', async () => {
    const entry = storedEntry({
      id: 'custom-entry',
      mediaType: customMediaType.id,
      metadata: { designer: 'A Designer' },
    });
    await db.mediaEntries.add(entry);
    await db.mediaTypes.add(customMediaType);
    await db.podcastSubscriptions.add(podcastSubscription);
    await db.appSettings.bulkPut([
      { key: SETTINGS_KEYS.colorMode, value: 'dark' },
      { key: SETTINGS_KEYS.malAccessToken, value: 'secret-token' },
      { key: SETTINGS_KEYS.plexServerUrl, value: 'https://private.example' },
    ]);

    const backup = await exportLibrary();
    expect(backup).toMatchObject({
      version: 2,
      entries: [entry],
      mediaTypes: [customMediaType],
      podcastSubscriptions: [podcastSubscription],
      settings: { [SETTINGS_KEYS.colorMode]: 'dark' },
    });
    expect(backup.settings).not.toHaveProperty(SETTINGS_KEYS.malAccessToken);
    expect(backup.settings).not.toHaveProperty(SETTINGS_KEYS.plexServerUrl);

    await db.mediaEntries.add(storedEntry({ id: 'local-only', title: 'Remove me' }));
    await importLibrary(backup, 'replace');

    expect(await db.mediaEntries.toArray()).toEqual([entry]);
    expect(await db.mediaTypes.toArray()).toEqual([customMediaType]);
    expect(await db.podcastSubscriptions.toArray()).toEqual([podcastSubscription]);
    expect((await db.appSettings.get(SETTINGS_KEYS.colorMode))?.value).toBe('dark');
    expect((await db.appSettings.get(SETTINGS_KEYS.malAccessToken))?.value).toBe(
      'secret-token',
    );
  });

  it('validates replacement safety before changing existing data', async () => {
    const existing = storedEntry({ id: 'existing', title: 'Keep me' });
    await db.mediaEntries.add(existing);

    const invalidBackup = {
      version: 2,
      entries: [{ id: 'broken' }],
      mediaTypes: [customMediaType],
      podcastSubscriptions: [],
      settings: {},
    };

    const preview = await inspectLibraryImport(invalidBackup);
    expect(preview).toMatchObject({ skippedEntryCount: 1, canReplace: false });
    await expect(importLibrary(invalidBackup, 'replace')).rejects.toThrow(
      'cannot safely replace',
    );
    expect(await db.mediaEntries.toArray()).toEqual([existing]);
  });

  it('accepts Version 1 backups for merge but not replacement', async () => {
    const entry = storedEntry({ id: 'legacy-entry' });
    const legacyBackup = { version: 1, entries: [entry], settings: {} };

    await expect(importLibrary(legacyBackup, 'merge')).resolves.toMatchObject({
      imported: 1,
      mode: 'merge',
    });
    await expect(importLibrary(legacyBackup, 'replace')).rejects.toThrow(
      'Version 1 backups can only be merged',
    );
  });
});
