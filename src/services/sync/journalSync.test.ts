import { describe, expect, it } from 'vitest';
import { storedEntry } from '@/test/factories';
import type { ExportPayload } from '@/services/importExport/importExportService';
import { calculateJournalHash, mergeJournalSnapshots } from './journalSync';
import { SETTINGS_KEYS } from '@/models';

function snapshot(
  entries: ExportPayload['entries'],
  settings: Record<string, unknown> = {},
): ExportPayload {
  return {
    version: 2,
    exportedAt: '2026-09-16T09:00:00.000Z',
    entries,
    mediaTypes: [],
    podcastSubscriptions: [],
    settings,
  };
}

describe('journal sync reconciliation', () => {
  it('hashes equal journal content identically regardless of export time and order', async () => {
    const first = snapshot([storedEntry({ id: 'b' }), storedEntry({ id: 'a' })]);
    const second = {
      ...snapshot([storedEntry({ id: 'a' }), storedEntry({ id: 'b' })]),
      exportedAt: '2026-09-16T10:00:00.000Z',
    };

    await expect(calculateJournalHash(first)).resolves.toBe(
      await calculateJournalHash(second),
    );
  });

  it('keeps unique entries and chooses the newest matching entry', () => {
    const cloud = snapshot(
      [
        storedEntry({ id: 'cloud-only' }),
        storedEntry({
          id: 'shared',
          title: 'Cloud title',
          updatedAt: '2026-09-16T09:00:00.000Z',
        }),
      ],
      { selectedTheme: 'cloud' },
    );
    const local = snapshot(
      [
        storedEntry({ id: 'local-only' }),
        storedEntry({
          id: 'shared',
          title: 'Local title',
          updatedAt: '2026-09-16T10:00:00.000Z',
        }),
      ],
      { selectedTheme: 'local', colorMode: 'dark' },
    );

    const merged = mergeJournalSnapshots(cloud, local);

    expect(merged.entries.map(({ id }) => id)).toEqual([
      'cloud-only',
      'local-only',
      'shared',
    ]);
    expect(merged.entries.find(({ id }) => id === 'shared')?.title).toBe('Local title');
    expect(merged.settings).toEqual({ selectedTheme: 'cloud', colorMode: 'dark' });
  });

  it('does not resurrect a Data Health merge removed on one device', () => {
    const cloud = snapshot([
      storedEntry({ id: 'keep' }),
      storedEntry({ id: 'duplicate' }),
    ]);
    const local = snapshot(
      [storedEntry({ id: 'keep', updatedAt: '2026-09-16T11:00:00.000Z' })],
      {
        [SETTINGS_KEYS.entryDeletionEvents]: [
          { id: 'duplicate', eventId: 'delete-duplicate', undone: false },
        ],
      },
    );

    const merged = mergeJournalSnapshots(cloud, local);
    expect(merged.entries.map(({ id }) => id)).toEqual(['keep']);
    expect(merged.settings[SETTINGS_KEYS.entryDeletionEvents]).toEqual([
      { id: 'duplicate', eventId: 'delete-duplicate', undone: false },
    ]);
    expect(mergeJournalSnapshots(merged, cloud).entries.map(({ id }) => id)).toEqual([
      'keep',
    ]);
  });

  it('combines deletions from both devices', () => {
    const cloud = snapshot([storedEntry({ id: 'local-removed' })], {
      [SETTINGS_KEYS.entryDeletionEvents]: [
        { id: 'cloud-removed', eventId: 'cloud-delete', undone: false },
      ],
    });
    const local = snapshot([storedEntry({ id: 'cloud-removed' })], {
      [SETTINGS_KEYS.entryDeletionEvents]: [
        { id: 'local-removed', eventId: 'local-delete', undone: false },
      ],
    });

    const merged = mergeJournalSnapshots(cloud, local);
    expect(merged.entries).toEqual([]);
    expect(merged.settings[SETTINGS_KEYS.entryDeletionEvents]).toEqual([
      { id: 'cloud-removed', eventId: 'cloud-delete', undone: false },
      { id: 'local-removed', eventId: 'local-delete', undone: false },
    ]);
  });

  it('keeps an Undo even when deletion already reached the cloud', () => {
    const deleted = { id: 'restored', eventId: 'delete-restored', undone: false };
    const cloud = snapshot([], { [SETTINGS_KEYS.entryDeletionEvents]: [deleted] });
    const local = snapshot([storedEntry({ id: 'restored' })], {
      [SETTINGS_KEYS.entryDeletionEvents]: [{ ...deleted, undone: true }],
    });

    const merged = mergeJournalSnapshots(cloud, local);
    expect(merged.entries.map(({ id }) => id)).toEqual(['restored']);
    expect(merged.settings[SETTINGS_KEYS.entryDeletionEvents]).toEqual([
      { ...deleted, undone: true },
    ]);
  });
});
