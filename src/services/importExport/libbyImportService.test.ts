import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/database/db';
import {
  applyLibbyRow,
  classifyLibbyRows,
  parseLibbyTimeline,
} from './libbyImportService';

const timeline = (timestamps: number[]) =>
  JSON.stringify({
    version: 1,
    timeline: [
      ...timestamps.map((timestamp) => ({
        title: {
          text: 'Nova (2013), Volume 5',
          titleId: '123',
          url: 'https://example.com/123',
        },
        author: 'Gerry Duggan',
        publisher: 'Marvel',
        isbn: '9781302479978',
        timestamp,
        activity: 'Borrowed',
        cover: { format: 'ebook', url: 'https://example.com/cover.jpg' },
      })),
      {
        title: { text: 'The Night Circus', titleId: '456' },
        author: 'Erin Morgenstern',
        publisher: 'Random House Audio Go',
        isbn: '9781446482858',
        timestamp: Date.parse('2021-03-01T18:23:04Z'),
        activity: 'Borrowed',
        cover: { format: 'audiobook' },
      },
      {
        title: { text: 'Ignore this event' },
        timestamp: Date.parse('2024-01-01T00:00:00Z'),
        activity: 'Returned',
        cover: { format: 'ebook' },
      },
    ],
  });

describe('Libby timeline import', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it('groups repeat loan events, preserves dates, and identifies audiobook/comic types', () => {
    const rows = parseLibbyTimeline(
      timeline([
        Date.parse('2024-02-01T12:00:00Z'),
        Date.parse('2023-01-01T12:00:00Z'),
        Date.parse('2024-02-01T12:00:00Z'),
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: 'Nova (2013), Volume 5',
      mediaType: 'comic',
      isbn: '9781302479978',
      borrowDates: ['2023-01-01', '2024-02-01'],
    });
    expect(rows[1]).toMatchObject({ title: 'The Night Circus', mediaType: 'audiobook' });
  });

  it('skips unchanged re-uploads and adds later loan dates to the existing Libby entry', async () => {
    const original = parseLibbyTimeline(
      timeline([Date.parse('2023-01-01T12:00:00Z'), Date.parse('2024-02-01T12:00:00Z')]),
    );
    const firstPass = await classifyLibbyRows(original);
    for (const row of firstPass) await applyLibbyRow(row);

    const sameUpload = await classifyLibbyRows(
      parseLibbyTimeline(
        timeline([
          Date.parse('2023-01-01T12:00:00Z'),
          Date.parse('2024-02-01T12:00:00Z'),
        ]),
      ),
    );
    expect(sameUpload.every((row) => row.status === 'duplicate')).toBe(true);

    const laterUpload = await classifyLibbyRows(
      parseLibbyTimeline(
        timeline([
          Date.parse('2023-01-01T12:00:00Z'),
          Date.parse('2024-02-01T12:00:00Z'),
          Date.parse('2025-06-15T12:00:00Z'),
        ]),
      ),
    );
    const nova = laterUpload.find((row) => row.row.isbn === '9781302479978')!;
    expect(nova.status).toBe('new_loans');
    expect(await applyLibbyRow(nova)).toBe('updated');

    const entries = await db.mediaEntries.toArray();
    expect(entries).toHaveLength(2);
    const novaEntry = entries.find((entry) => entry.metadata.isbn === '9781302479978')!;
    expect(novaEntry.metadata.libbyLoanDates).toBe('2023-01-01,2024-02-01,2025-06-15');
    expect(novaEntry.metadata.libbyLoanEventCount).toBe(3);
  });

  it('rejects unsupported JSON shapes with a clear message', () => {
    expect(() => parseLibbyTimeline('{"timeline":[]}')).toThrow(
      'version 1 timeline export',
    );
    expect(() => parseLibbyTimeline('not json')).toThrow('not valid JSON');
  });
});
