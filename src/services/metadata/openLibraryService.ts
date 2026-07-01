/**
 * Open Library metadata lookup for books and audiobooks.
 * No API key required — completely free and open.
 * https://openlibrary.org/developers/api
 */

export interface SearchResult {
  id: string;
  title: string;
  /** Short descriptor shown in the dropdown — e.g. "Cormac McCarthy · 2006" */
  subtitle: string;
  /** Fields to pre-fill in the entry form on selection. */
  fields: Record<string, string>;
}

const BASE = 'https://openlibrary.org';

/**
 * Searches Open Library by title and returns up to 6 results.
 * All metadata is returned in a single call (no second fetch on
 * selection) because the search endpoint supports field projection.
 */
export async function searchBooks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    title: query,
    limit: '6',
    fields: 'key,title,author_name,series,first_publish_year,editions',
  });

  const res = await fetch(`${BASE}/search.json?${params.toString()}`);
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`);

  const data = await res.json() as {
    docs: Array<{
      key: string;
      title: string;
      author_name?: string[];
      series?: string[];
      first_publish_year?: number;
    }>;
  };

  return data.docs.map((doc) => {
    const author = doc.author_name?.[0] ?? '';
    const series = doc.series?.[0] ?? '';
    const year = doc.first_publish_year ? String(doc.first_publish_year) : '';

    const subtitleParts = [author, year].filter(Boolean);
    if (series) subtitleParts.push(`${series} series`);

    const fields: Record<string, string> = {};
    if (author) fields['author'] = author;
    if (series) fields['series'] = series;

    return {
      id: doc.key,
      title: doc.title,
      subtitle: subtitleParts.join(' · '),
      fields,
    };
  });
}
