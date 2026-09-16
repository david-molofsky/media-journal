import { describe, expect, it } from 'vitest';
import { parseNetflixCsv } from './netflixImportService';
import { parseAmazonPrimeCsv } from './amazonPrimeImportService';
import { parseLetterboxdDiary } from './letterboxdImportService';

describe('external import parsers', () => {
  it('deduplicates Netflix titles using the latest valid viewing date', () => {
    const rows = parseNetflixCsv(
      'Title,Date\nFilm A,1/1/26\nFilm A,2/1/26\nFilm A Trailer,3/1/26\nBad,not-a-date',
    );

    expect(rows).toEqual([{ title: 'Film A', date: '2026-02-01' }]);
  });

  it('parses Prime movies and series while rejecting unknown types', () => {
    const rows = parseAmazonPrimeCsv(
      'Title,Type,Date Watched\nFilm A,Movie,2026-01-02 10:20:30\nShow S1 E1,Series,2026-01-03\nIgnored,Clip,2026-01-04',
    );

    expect(rows).toEqual([
      { title: 'Film A', type: 'Movie', date: '2026-01-02' },
      { title: 'Show S1 E1', type: 'Series', date: '2026-01-03' },
    ]);
  });

  it('converts Letterboxd ratings and tags', () => {
    const [row] = parseLetterboxdDiary(
      'Name,Year,Watched Date,Rating,Rewatch,Tags\nFilm A,2025,2026-01-02,4.5,Yes,"Sci-Fi, Favourite"',
    );

    expect(row).toMatchObject({
      name: 'Film A',
      year: '2025',
      watchedDate: '2026-01-02',
      rating: 9,
      rewatch: true,
      tags: ['sci-fi', 'favourite'],
    });
  });
});
