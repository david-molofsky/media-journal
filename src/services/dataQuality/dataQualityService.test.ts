import { describe, expect, it } from 'vitest';
import { storedEntry } from '@/test/factories';
import { analyseDataHealth } from './dataQualityService';

describe('data quality analysis', () => {
  it('finds same-consumption duplicates but permits a later rewatch', () => {
    const report = analyseDataHealth([
      storedEntry({ id: 'one', title: 'Dune: Part Two' }),
      storedEntry({ id: 'two', title: ' dune part two ' }),
      storedEntry({ id: 'three', title: 'Dune Part Two', completedDate: '2026-09-16' }),
    ]);

    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]?.entries.map(({ id }) => id).sort()).toEqual([
      'one',
      'two',
    ]);
  });

  it('finds source aliases and case or punctuation variations', () => {
    const report = analyseDataHealth([
      storedEntry({
        id: 'one',
        metadata: { source: 'Prime Video' },
        genres: ['Sci-Fi'],
        tags: ['Space Opera'],
      }),
      storedEntry({
        id: 'two',
        title: 'Arrival',
        metadata: { source: 'Amazon Prime' },
        genres: ['sci fi'],
        tags: ['space-opera'],
      }),
    ]);

    expect(report.variations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'source', canonical: 'Amazon Prime Video' }),
        expect.objectContaining({ field: 'genre' }),
        expect.objectContaining({ field: 'tag' }),
      ]),
    );
  });

  it('hides an accepted group but flags it again when the group changes', () => {
    const entries = [
      storedEntry({ id: 'one', title: 'Dune' }),
      storedEntry({ id: 'two', title: 'Dune' }),
    ];
    const acceptanceKey = JSON.stringify(['one', 'two']);

    expect(analyseDataHealth(entries, [acceptanceKey]).duplicates).toHaveLength(0);
    expect(
      analyseDataHealth(
        [...entries, storedEntry({ id: 'three', title: 'Dune' })],
        [acceptanceKey],
      ).duplicates,
    ).toHaveLength(1);
  });

  it('flags completed records without a date and records without a media type', () => {
    const report = analyseDataHealth([
      storedEntry({ id: 'one', completedDate: undefined }),
      storedEntry({ id: 'two', mediaType: '' }),
    ]);

    expect(report.incompleteEntries).toHaveLength(2);
    expect(report.issueCount).toBe(2);
  });
});
