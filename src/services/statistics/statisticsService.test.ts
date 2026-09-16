import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { storedEntry } from '@/test/factories';
import {
  applyStatsFilters,
  getEntryWeight,
  isWithinRollingWindowEnding,
  isWithinYearScope,
} from './statisticsService';

describe('statistics calculations', () => {
  it('combines media type, genre, tag and rating filters', () => {
    const matching = storedEntry({
      id: 'matching',
      mediaType: 'book',
      genres: ['Sci-Fi'],
      tags: ['favourite'],
      rating: 8.5,
    });
    const wrongRating = storedEntry({ id: 'other', mediaType: 'book', rating: 6 });

    expect(
      applyStatsFilters([matching, wrongRating], {
        mediaTypeIds: ['book'],
        genre: 'Sci-Fi',
        tag: 'favourite',
        ratingMin: 8,
      }),
    ).toEqual([matching]);
  });

  it('counts comic ranges and TV episodes inclusively', () => {
    expect(
      getEntryWeight(
        storedEntry({ mediaType: 'comic', metadata: { issueStart: 6, issueEnd: 11 } }),
        'season',
      ),
    ).toBe(6);
    expect(
      getEntryWeight(
        storedEntry({ mediaType: 'tv', metadata: { episodeStart: 2, episodeEnd: 5 } }),
        'episode',
      ),
    ).toBe(4);
  });

  it('applies calendar and rolling time windows', () => {
    expect(isWithinYearScope('2025-12-31', 2025)).toBe(true);
    expect(isWithinYearScope('2025-12-31', 2026)).toBe(false);
    expect(isWithinRollingWindowEnding('2025-07-01', dayjs('2026-06-30'), 12)).toBe(true);
    expect(isWithinRollingWindowEnding('2025-06-30', dayjs('2026-06-30'), 12)).toBe(
      false,
    );
  });
});
