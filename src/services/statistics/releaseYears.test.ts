import { describe, expect, it } from 'vitest';
import { storedEntry } from '@/test/factories';
import { releaseYearOf } from './releaseYears';

describe('releaseYearOf', () => {
  it.each([
    ['book', { releaseYear: 1984 }, 1984],
    ['audiobook', { releaseYear: '2001' }, 2001],
    ['film', { releaseDate: '2024-03-01' }, 2024],
    ['tv', { releaseDate: '1999-01-10' }, 1999],
    ['comic', { coverDate: '2023-05' }, 2023],
    ['custom', { publicationYear: 1970 }, 1970],
  ])('reads release metadata for %s', (mediaType, metadata, expected) => {
    expect(releaseYearOf(storedEntry({ mediaType, metadata }))).toBe(expected);
  });

  it.each([
    {},
    { releaseYear: '' },
    { releaseYear: true },
    { releaseDate: 'invalid' },
    { releaseYear: 0 },
  ])('keeps unknown years separate from completion dates', (metadata) => {
    expect(releaseYearOf(storedEntry({ metadata }))).toBeNull();
  });
});
