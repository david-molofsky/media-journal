import { describe, expect, it } from 'vitest';
import { storedEntry } from '@/test/factories';
import type { ExportPayload } from '@/services/importExport/importExportService';
import { calculateJournalHash, mergeJournalSnapshots } from './journalSync';

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
});
