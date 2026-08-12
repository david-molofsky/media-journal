/**
 * Maps Open Library's free-text `subject` tags (Library of Congress
 * Subject Headings mixed in with noisy non-genre tags like
 * "Nyt:hardcover-fiction=2023-01-15") onto a fixed genre vocabulary,
 * the same way tmdbService's GENRE_NAME_MAP normalises TMDB's genre
 * list. See chat (Aug 2026) for full scope.
 *
 * Two-part match, same call in both callers:
 *  1. `SUBJECT_KEYWORD_MAP` — curated keyword → canonical genre(s).
 *     Case-insensitive substring match against each subject string.
 *  2. Any OTHER genre already used somewhere in the user's library
 *     (i.e. a custom genre they typed themselves, not part of
 *     `CANONICAL_GENRES`) is also matched — case-insensitive substring
 *     of the genre name itself against the subject string. This means
 *     a manually-added genre like "Cyberpunk" starts getting matched
 *     against future Open Library lookups without any code change,
 *     the moment it's used once.
 *
 * Non-matching subjects are dropped silently — Open Library's subject
 * list is too noisy to surface unfiltered (unlike TMDB's genres, which
 * pass through unmapped names as-is).
 */

/**
 * The full genre vocabulary this mapping can produce. Mirrors (and
 * extends) GenreInput.tsx's STARTER_GENRES: everything from TMDB's
 * genre list (post GENRE_NAME_MAP normalisation) that could plausibly
 * apply to a book, plus book-only genres with no film/TV equivalent
 * (Fiction, Non-Fiction, Children's Fiction, Biography, Autobiography,
 * Memoir, and similar — added per David's request, Aug 2026).
 *
 * Deliberately NOT wired into GenreInput's suggestion list or any Zod
 * enum — genres remain freeform everywhere else in the app. This is
 * only the target list for *this* mapping.
 */
export const CANONICAL_GENRES = [
  // Shared with TMDB's vocabulary (post GENRE_NAME_MAP normalisation)
  'Action',
  'Adventure',
  'Animation',
  'Biography',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Superhero',
  'Thriller',
  'War',
  'Western',
  // Book-specific — no film/TV equivalent
  'Autobiography',
  "Children's Fiction",
  'Classic Literature',
  'Essays',
  'Fiction',
  'Memoir',
  'Non-Fiction',
  'Philosophy',
  'Poetry',
  'Religion & Spirituality',
  'Self-Help',
  'Short Stories',
  'True Crime',
  'Young Adult',
] as const;

/**
 * Keyword → genre(s). Keys are matched as a case-insensitive substring
 * against each Open Library subject string, same convention as
 * tmdbService's GENRE_NAME_MAP. One keyword can map to more than one
 * genre (e.g. "detective and mystery stories" implies both Mystery and
 * Crime); order doesn't matter, results are deduped downstream.
 *
 * Keywords are lowercase and reasonably specific, chosen from Open
 * Library's real LCSH-derived subject phrasing rather than guessed —
 * broad single words like "fiction" alone are intentionally narrow
 * (see the 'fiction' entry) to avoid over-matching against unrelated
 * compound subjects like "Science fiction" (handled separately, more
 * specifically, above it).
 */
const SUBJECT_KEYWORD_MAP: Record<string, string[]> = {
  // Action / Adventure
  'adventure stories': ['Adventure'],
  'adventure fiction': ['Adventure'],
  'action and adventure fiction': ['Action', 'Adventure'],
  'spy stories': ['Action', 'Thriller'],
  'war stories': ['War', 'Action'],

  // Animation (rare on books, but Open Library does tag some
  // illustrated/animated tie-in works this way)
  animated: ['Animation'],

  // Biography / Autobiography / Memoir
  biography: ['Biography'],
  autobiography: ['Autobiography'],
  autobiographies: ['Autobiography'],
  memoir: ['Memoir'],
  memoirs: ['Memoir'],
  'personal narratives': ['Memoir'],

  // Comedy
  'humorous stories': ['Comedy'],
  'humorous fiction': ['Comedy'],
  humor: ['Comedy'],
  satire: ['Comedy'],

  // Crime / Mystery / Thriller
  'detective and mystery stories': ['Mystery', 'Crime'],
  'mystery fiction': ['Mystery'],
  'crime fiction': ['Crime'],
  'true crime': ['True Crime'],
  'suspense fiction': ['Thriller'],
  thriller: ['Thriller'],
  'noir fiction': ['Crime', 'Thriller'],

  // Documentary-adjacent nonfiction
  'essays': ['Essays'],

  // Drama
  drama: ['Drama'],
  tragedy: ['Drama'],
  tragedies: ['Drama'],

  // Family
  'family fiction': ['Family'],
  'domestic fiction': ['Family'],

  // Fantasy
  'fantasy fiction': ['Fantasy'],
  fantasy: ['Fantasy'],
  'magic fiction': ['Fantasy'],

  // History / Historical fiction
  'historical fiction': ['History'],
  history: ['History'],
  historical: ['History'],

  // Horror
  'horror fiction': ['Horror'],
  'horror tales': ['Horror'],
  'ghost stories': ['Horror'],
  supernatural: ['Horror'],

  // Music
  'musicians biography': ['Biography', 'Music'],

  // Philosophy / Religion
  philosophy: ['Philosophy'],
  religion: ['Religion & Spirituality'],
  religious: ['Religion & Spirituality'],
  spirituality: ['Religion & Spirituality'],
  theology: ['Religion & Spirituality'],

  // Poetry
  poetry: ['Poetry'],
  poems: ['Poetry'],

  // Romance
  'love stories': ['Romance'],
  'romance fiction': ['Romance'],

  // Sci-Fi (checked before the bare "fiction" fallback so
  // "science fiction" doesn't fall through to just Fiction)
  'science fiction': ['Sci-Fi'],
  'time travel fiction': ['Sci-Fi'],
  'space opera': ['Sci-Fi'],
  dystopia: ['Sci-Fi'],
  dystopian: ['Sci-Fi'],

  // Self-Help
  'self-help': ['Self-Help'],
  'self help': ['Self-Help'],
  'self-actualization': ['Self-Help'],
  'personal growth': ['Self-Help'],

  // Short Stories
  'short stories': ['Short Stories'],

  // Superhero
  superhero: ['Superhero'],
  superheroes: ['Superhero'],

  // War
  'military fiction': ['War'],

  // Western
  'western stories': ['Western'],
  'western fiction': ['Western'],

  // Young Adult / Children's
  'young adult fiction': ['Young Adult'],
  'juvenile fiction': ["Children's Fiction"],
  'juvenile literature': ["Children's Fiction"],
  "children's stories": ["Children's Fiction"],

  // Classic Literature
  'classic literature': ['Classic Literature'],
  classics: ['Classic Literature'],

  // Fiction (kept last and requires the standalone word so it doesn't
  // pre-empt any of the more specific "<x> fiction" phrases above —
  // matched only if none of those already fired, see mapOpenLibrarySubjectsToGenres)
  fiction: ['Fiction'],
  'non-fiction': ['Non-Fiction'],
  nonfiction: ['Non-Fiction'],
};

/**
 * Maps a raw list of Open Library `subject` strings onto this app's
 * genre vocabulary. `knownGenres` should be every genre currently used
 * anywhere in the library (both callers source this from
 * `db.mediaEntries` — see openLibraryService.ts and db.ts's v25
 * migration); any entry in there that ISN'T already part of
 * `CANONICAL_GENRES` is treated as a user-added custom genre and also
 * matched, so manually-typed genres start being detected in future
 * Open Library lookups without a code change.
 *
 * Returns an empty array (not undefined) when nothing matches — same
 * "silently drop the noise" behaviour as before, just now filtered
 * instead of taking the raw first N subjects.
 */
export function mapOpenLibrarySubjectsToGenres(
  subjects: string[],
  knownGenres: string[] = [],
): string[] {
  const matched = new Set<string>();
  const lowerSubjects = subjects.map((s) => s.toLowerCase());

  // 1. Curated keyword map. The bare "fiction"/"non-fiction" fallback
  // keys only fire if nothing more specific already matched that same
  // subject string, so "Science fiction" resolves to Sci-Fi alone
  // rather than Sci-Fi + Fiction.
  for (const subject of lowerSubjects) {
    const hitsForThisSubject: string[] = [];
    for (const [keyword, genres] of Object.entries(SUBJECT_KEYWORD_MAP)) {
      if (keyword === 'fiction' || keyword === 'non-fiction' || keyword === 'nonfiction') continue;
      if (subject.includes(keyword)) hitsForThisSubject.push(...genres);
    }
    if (hitsForThisSubject.length > 0) {
      hitsForThisSubject.forEach((g) => matched.add(g));
    } else if (subject.includes('non-fiction') || subject.includes('nonfiction')) {
      matched.add('Non-Fiction');
    } else if (subject.includes('fiction')) {
      matched.add('Fiction');
    }
  }

  // 2. User-added custom genres — direct case-insensitive substring
  // match of the genre name itself against each subject string.
  const canonicalLower = new Set(CANONICAL_GENRES.map((g) => g.toLowerCase()));
  for (const genre of knownGenres) {
    if (canonicalLower.has(genre.toLowerCase())) continue; // already handled above
    const lowerGenre = genre.toLowerCase();
    if (lowerSubjects.some((s) => s.includes(lowerGenre))) {
      matched.add(genre);
    }
  }

  return Array.from(matched);
}
