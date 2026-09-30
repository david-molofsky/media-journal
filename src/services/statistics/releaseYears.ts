import type { MediaEntry } from '@/models';

/** Release metadata only; completion dates never stand in for missing years. */
export function releaseYearOf(entry: MediaEntry): number | null {
  for (const key of ['releaseYear', 'publicationYear', 'releaseDate', 'coverDate']) {
    const value = entry.metadata[key];
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    const match = /^(\d{4})(?:$|[-/])/.exec(text);
    if (!match) continue;
    const year = Number(match[1]);
    if (year > 0) return year;
  }
  return null;
}
