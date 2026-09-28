import { describe, expect, it } from 'vitest';
import {
  findRepeatedNetflixPrefixes,
  parseNetflixCsv,
} from './netflixImportService';
import { parseAmazonPrimeCsv } from './amazonPrimeImportService';
import { parseLetterboxdDiary } from './letterboxdImportService';
import {
  looksLikeSeries,
  parseSeriesTitle,
  parseTitleSegment,
} from '@/utils/importTitleParsing';

describe('external import parsers', () => {
  it('deduplicates Netflix titles using the latest valid viewing date', () => {
    const rows = parseNetflixCsv(
      'Title,Date\nFilm A,1/1/26\nFilm A,2/1/26\nFilm A Trailer,3/1/26\nBad,not-a-date',
    );

    expect(rows).toEqual([{ title: 'Film A', date: '2026-02-01' }]);
  });

  it('recognises Netflix Series labels as numbered seasons', () => {
    expect(parseSeriesTitle('The IT Crowd: Series 5: The Final Episode')).toEqual({
      showTitle: 'The IT Crowd',
      seasonNumber: 5,
    });
  });

  it('recognises Netflix Volume labels as TV without inventing a season', () => {
    expect(
      parseSeriesTitle('Love, Death & Robots: Volume 3: Bad Travelling'),
    ).toEqual({
      showTitle: 'Love, Death & Robots',
      seasonNumber: undefined,
    });
    expect(
      looksLikeSeries('Love, Death & Robots: Volume 3: Bad Travelling'),
    ).toBe(true);
  });

  it('lets Netflix treat Part labels as unresolved while preserving the shared default', () => {
    expect(parseTitleSegment('Part 4')).toEqual({ isSeries: true, seasonNumber: 4 });
    expect(
      parseTitleSegment('Part 4', { resolvePartAsSeason: false }),
    ).toEqual({
      isSeries: true,
      seasonNumber: undefined,
    });
  });

  it('finds repeated legacy Netflix show prefixes without treating one-off colon titles as evidence', () => {
    const rows = [
      { title: "Community: Pascal's Triangle Revisited", date: '2022-11-25' },
      { title: 'Community: Modern Warfare', date: '2022-11-24' },
      { title: 'Captain America: Civil War', date: '2022-11-23' },
    ];

    expect(findRepeatedNetflixPrefixes(rows)).toEqual(new Set(['community']));
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
