import { db } from '@/services/database/db';
import { updateEntry } from '@/services/database/entryService';
import { getSetting } from '@/services/database/settingsService';
import { searchFilms, getFilmDetails, searchTV, getTVDetails } from '@/services/metadata/tmdbService';
import { searchSeries, getIssueDetails } from '@/services/metadata/comicVineService';
import { searchBooks } from '@/services/metadata/openLibraryService';
import type { SearchResult } from '@/services/metadata/openLibraryService';
import type { MediaEntry, EntryMetadata, MetadataValue } from '@/models';

/**
 * Backfill targets Film/TV (TMDB), Comic Issues (ComicVine), and Books
 * (Open Library). Audiobooks are deliberately excluded — they share
 * Book's metadata schema but weren't part of David's Release
 * Year/Backfill scoping, and have no `releaseYear` field in their
 * `fields[]` to backfill into. One button, one dialog, one selection
 * can mix all four supported media types in a single run.
 */
export type BackfillableField =
  | 'overview'
  | 'runtime'
  | 'productionCompany'
  | 'network'
  | 'series'
  | 'tvStatus'
  | 'posterPath'
  | 'publisher'
  | 'issueTitle'
  | 'coverDate'
  | 'writer'
  | 'penciller'
  | 'inker'
  | 'colorist'
  | 'letterer'
  | 'coverArtist'
  | 'editor'
  | 'coverImagePath'
  | 'author'
  | 'releaseYear';

const FILM_FIELDS: BackfillableField[] = ['overview', 'runtime', 'productionCompany', 'series', 'posterPath'];
// No 'series' for TV — TMDB has no TV equivalent of a film "collection"
// (see tmdbService.ts), so it's never a backfill candidate for TV.
const TV_FIELDS: BackfillableField[] = ['overview', 'runtime', 'network', 'tvStatus', 'posterPath'];
// No 'series' for Comic either, but for a different reason than TV:
// metadata.series is comic backfill's *search input*, not an output —
// it has to already be present to look anything up on ComicVine, so it
// can never itself be a "missing field" this flow fills in.
const COMIC_FIELDS: BackfillableField[] = [
  'publisher',
  'issueTitle',
  'coverDate',
  'writer',
  'penciller',
  'inker',
  'colorist',
  'letterer',
  'coverArtist',
  'editor',
  'coverImagePath',
];
// Book only (not Audiobook — see module doc comment above). Unlike
// Film/TV/Comic, `coverImagePath` and `releaseYear` here are gated by
// their own Open Library-specific toggles (autofillBookCoverImage/
// autofillBookReleaseYear), not the shared `enabledFieldsMap()` below
// — see `bookEnabledFieldsMap()`.
const BOOK_FIELDS: BackfillableField[] = ['author', 'series', 'coverImagePath', 'releaseYear'];

function hasValue(value: MetadataValue): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/** Human-readable label for the review screen's source tag and default
 * "no match" wording — derived from mediaType rather than stored
 * per-match, since it's always a pure function of which service a
 * given entry's matches came from. */
export function matchSourceLabel(mediaType: string): string {
  if (mediaType === 'comic') return 'ComicVine';
  if (mediaType === 'book') return 'Open Library';
  return 'TMDB';
}

/** Reads the same Settings > Metadata auto-fill toggles tmdbService and
 * comicVineService read, so backfill only ever fills what regular
 * auto-fill would have filled. `productionCompany` and `network` share
 * one toggle (`autofillProductionCompany`), same as in tmdbService. */
async function enabledFieldsMap(): Promise<Partial<Record<BackfillableField, boolean>>> {
  const [
    overview,
    runtime,
    productionCompany,
    tvStatus,
    series,
    poster,
    comicPublisher,
    comicIssueTitle,
    comicCoverDate,
    comicWriter,
    comicPenciller,
    comicInker,
    comicColorist,
    comicLetterer,
    comicCoverArtist,
    comicEditor,
    comicCoverImage,
  ] = await Promise.all([
    getSetting('autofillOverview', true),
    getSetting('autofillRuntime', true),
    getSetting('autofillProductionCompany', true),
    getSetting('autofillTvStatus', true),
    getSetting('autofillSeries', true),
    getSetting('autofillPoster', true),
    getSetting('autofillComicPublisher', true),
    getSetting('autofillComicIssueTitle', true),
    getSetting('autofillComicCoverDate', true),
    getSetting('autofillComicWriter', true),
    getSetting('autofillComicPenciller', true),
    getSetting('autofillComicInker', true),
    getSetting('autofillComicColorist', true),
    getSetting('autofillComicLetterer', true),
    getSetting('autofillComicCoverArtist', true),
    getSetting('autofillComicEditor', true),
    getSetting('autofillComicCoverImage', true),
  ]);
  return {
    overview,
    runtime,
    productionCompany,
    network: productionCompany,
    series,
    tvStatus,
    posterPath: poster,
    publisher: comicPublisher,
    issueTitle: comicIssueTitle,
    coverDate: comicCoverDate,
    writer: comicWriter,
    penciller: comicPenciller,
    inker: comicInker,
    colorist: comicColorist,
    letterer: comicLetterer,
    coverArtist: comicCoverArtist,
    editor: comicEditor,
    coverImagePath: comicCoverImage,
  };
}

/** Book's own enabled-fields lookup — kept separate from
 * `enabledFieldsMap()` above rather than merged into it, because two
 * of Book's field keys collide in name (but not meaning) with fields
 * already used by other media types: `coverImagePath` is gated by
 * `autofillBookCoverImage` here vs `autofillComicCoverImage` for
 * Comic, and `series` is always enabled here vs gated by
 * `autofillSeries` (Film's TMDB collection toggle) above. Author and
 * Series are never gated by a toggle at all, matching
 * openLibraryService.ts's "always filled" convention for those two. */
async function bookEnabledFieldsMap(): Promise<Partial<Record<BackfillableField, boolean>>> {
  const [coverImagePath, releaseYear] = await Promise.all([
    getSetting('autofillBookCoverImage', true),
    getSetting('autofillBookReleaseYear', true),
  ]);
  return { author: true, series: true, coverImagePath, releaseYear };
}

export interface BackfillCandidate {
  entry: MediaEntry;
  missingFields: BackfillableField[];
}

/** Narrows a selection down to Film/TV/Comic entries that are missing
 * at least one currently-enabled field. Everything else (wrong media
 * type, or already fully filled) is silently excluded rather than
 * shown as a zero-work row. */
export async function computeBackfillCandidates(
  selectedIds: string[],
): Promise<BackfillCandidate[]> {
  const entries = (await db.mediaEntries.bulkGet(selectedIds)).filter(
    (e): e is MediaEntry => e !== undefined,
  );
  const [enabled, bookEnabled] = await Promise.all([enabledFieldsMap(), bookEnabledFieldsMap()]);

  const candidates: BackfillCandidate[] = [];
  for (const entry of entries) {
    if (
      entry.mediaType !== 'film' &&
      entry.mediaType !== 'tv' &&
      entry.mediaType !== 'comic' &&
      entry.mediaType !== 'book'
    ) {
      continue;
    }
    const fieldKeys =
      entry.mediaType === 'film'
        ? FILM_FIELDS
        : entry.mediaType === 'tv'
          ? TV_FIELDS
          : entry.mediaType === 'comic'
            ? COMIC_FIELDS
            : BOOK_FIELDS;
    const activeEnabled = entry.mediaType === 'book' ? bookEnabled : enabled;
    const missingFields = fieldKeys.filter(
      (key) => activeEnabled[key] && !hasValue(entry.metadata[key]),
    );
    if (missingFields.length > 0) candidates.push({ entry, missingFields });
  }
  return candidates;
}

export type MatchStatus = 'auto' | 'ambiguous' | 'none' | 'skipped';

export interface MatchState {
  entry: MediaEntry;
  missingFields: BackfillableField[];
  /** Up to 5 candidates for the confirm screen; empty when status is 'none'. */
  candidates: SearchResult[];
  status: MatchStatus;
  /** TMDB or ComicVine id of the chosen candidate — set automatically
   * for 'auto', or by the user picking from `candidates` on the
   * confirm screen. */
  selectedId?: string;
  /** Overrides the review screen's default "no match found" wording
   * for a 'none' status that isn't simply "nothing found" — currently
   * only comic entries missing `series` or an issue number, which
   * can't be searched on ComicVine at all. */
  reason?: string;
  /** Comic-only: set when the entry spans more than one issue
   * (issueEnd > issueStart). ComicVine detail — credits, cover date,
   * cover image — is always fetched for issueStart alone, the same
   * single-issue behaviour EntryForm's "Fetch issue details" button
   * already has, so this just surfaces that on the review screen
   * rather than changing what gets fetched. */
  note?: string;
}

/** Searches TMDB by title for a single Film/TV candidate and
 * classifies the result: an exact (case-insensitive) title match with
 * nothing else competing auto-matches with no confirmation needed;
 * anything with multiple close results, or none, needs the person's
 * input. */
async function matchFilmOrTvCandidate(
  entry: MediaEntry,
  missingFields: BackfillableField[],
): Promise<MatchState> {
  const searchFn = entry.mediaType === 'film' ? searchFilms : searchTV;
  const results = await searchFn(entry.title);

  const exactMatches = results.filter(
    (r) => r.title.trim().toLowerCase() === entry.title.trim().toLowerCase(),
  );

  if (exactMatches.length === 1) {
    const match = exactMatches[0];
    if (match) {
      return { entry, missingFields, candidates: results, status: 'auto', selectedId: match.id };
    }
  }
  if (results.length === 0) {
    return { entry, missingFields, candidates: [], status: 'none' };
  }
  // Bug fix: ambiguous entries need a default selection — the confirmed
  // wireframe showed the first candidate pre-selected (still changeable,
  // still skippable), but this returned no `selectedId` at all, so
  // clicking "Apply" without touching the radio group silently skipped
  // the entry instead of using the top result.
  const topCandidates = results.slice(0, 5);
  return { entry, missingFields, candidates: topCandidates, status: 'ambiguous', selectedId: topCandidates[0]?.id };
}

/** Searches ComicVine by series name (not entry.title — a comic's
 * title often isn't the series name verbatim, e.g. "The Walking Dead
 * #65", whereas metadata.series is exactly what ComicVine's volume
 * search expects). Entries missing `series` or a numeric issue number
 * can't be searched at all — they're classified 'none' with an
 * explanatory `reason` rather than attempting (and failing) a call. */
async function matchComicCandidate(
  entry: MediaEntry,
  missingFields: BackfillableField[],
): Promise<MatchState> {
  const series = entry.metadata.series;
  const issueStart = entry.metadata.issueStart;
  const issueEnd = entry.metadata.issueEnd;

  if (typeof series !== 'string' || !series.trim() || typeof issueStart !== 'number') {
    return {
      entry,
      missingFields,
      candidates: [],
      status: 'none',
      reason: 'Series and issue number are required to search ComicVine.',
    };
  }

  const note =
    typeof issueEnd === 'number' && issueEnd > issueStart
      ? `Based on issue ${issueStart} only (issues ${issueStart}\u2013${issueEnd}).`
      : undefined;

  const results = await searchSeries(series);
  const exactMatches = results.filter(
    (r) => r.title.trim().toLowerCase() === series.trim().toLowerCase(),
  );

  if (exactMatches.length === 1) {
    const match = exactMatches[0];
    if (match) {
      return { entry, missingFields, candidates: results, status: 'auto', selectedId: match.id, note };
    }
  }
  if (results.length === 0) {
    return { entry, missingFields, candidates: [], status: 'none', note };
  }
  const topCandidates = results.slice(0, 5);
  return {
    entry,
    missingFields,
    candidates: topCandidates,
    status: 'ambiguous',
    selectedId: topCandidates[0]?.id,
    note,
  };
}

/** Searches Open Library by title for a single Book candidate — same
 * exact-match/ambiguous/none classification as `matchFilmOrTvCandidate`
 * above. Unlike Film/TV, `results` here already carry every field
 * this flow needs (author, series, cover, release year) straight from
 * the search call — Open Library's search index returns them all in
 * one shot, so there's no separate "detail fetch" step for Books (see
 * `applyBookMatch` below, which reads directly off the matched
 * candidate rather than making a second network call). */
async function matchBookCandidate(
  entry: MediaEntry,
  missingFields: BackfillableField[],
): Promise<MatchState> {
  const results = await searchBooks(entry.title);

  const exactMatches = results.filter(
    (r) => r.title.trim().toLowerCase() === entry.title.trim().toLowerCase(),
  );

  if (exactMatches.length === 1) {
    const match = exactMatches[0];
    if (match) {
      return { entry, missingFields, candidates: results, status: 'auto', selectedId: match.id };
    }
  }
  if (results.length === 0) {
    return { entry, missingFields, candidates: [], status: 'none' };
  }
  const topCandidates = results.slice(0, 5);
  return { entry, missingFields, candidates: topCandidates, status: 'ambiguous', selectedId: topCandidates[0]?.id };
}

/** Classifies one backfill candidate against its media type's search
 * source. Calls are made one candidate at a time by the caller (a
 * sequential loop, not Promise.all) to avoid bursting either TMDB's or
 * ComicVine's rate limits on a large mixed selection. */
export async function matchCandidate(candidate: BackfillCandidate): Promise<MatchState> {
  const { entry, missingFields } = candidate;
  if (entry.mediaType === 'comic') return matchComicCandidate(entry, missingFields);
  if (entry.mediaType === 'book') return matchBookCandidate(entry, missingFields);
  return matchFilmOrTvCandidate(entry, missingFields);
}

/** Applies one resolved Film/TV match: fetches TMDB details, then
 * writes only the fields that were actually missing (never overwrites
 * anything already present, and never touches a field this entry
 * didn't need) plus merges any genre guesses, same merge-don't-
 * overwrite rule as regular auto-fill. */
async function applyFilmOrTvMatch(state: MatchState): Promise<'updated' | 'skipped'> {
  if (!state.selectedId) return 'skipped';
  const getDetails = state.entry.mediaType === 'film' ? getFilmDetails : getTVDetails;
  const { fields, genres } = await getDetails(state.selectedId);

  const metadata: EntryMetadata = { ...state.entry.metadata };
  let changed = false;
  for (const key of state.missingFields) {
    const value = fields[key];
    if (value === undefined) continue;
    metadata[key] = key === 'runtime' ? Number(value) : value;
    changed = true;
  }

  const existingGenres = state.entry.genres ?? [];
  const mergedGenres =
    genres && genres.length > 0
      ? Array.from(new Set([...existingGenres, ...genres]))
      : existingGenres;

  if (!changed && mergedGenres.length === existingGenres.length) return 'skipped';

  await updateEntry(state.entry.id, { metadata, genres: mergedGenres });
  return 'updated';
}

/** Applies one resolved Comic match: fetches ComicVine issue detail
 * for issueStart (see the `note` field on MatchState re: multi-issue
 * entries), then writes only the fields that were actually missing.
 * No genre merging — ComicVine has no genre concept, unlike TMDB. */
async function applyComicMatch(state: MatchState): Promise<'updated' | 'skipped'> {
  if (!state.selectedId) return 'skipped';
  const issueStart = state.entry.metadata.issueStart;
  if (typeof issueStart !== 'number') return 'skipped';

  const { fields } = await getIssueDetails(state.selectedId, String(issueStart));
  if (Object.keys(fields).length === 0) return 'skipped';

  const metadata: EntryMetadata = { ...state.entry.metadata };
  let changed = false;
  for (const key of state.missingFields) {
    const value = fields[key];
    if (value === undefined) continue;
    metadata[key] = value;
    changed = true;
  }
  if (!changed) return 'skipped';

  await updateEntry(state.entry.id, { metadata });
  return 'updated';
}

/** Applies one resolved Book match. No second fetch needed — see
 * `matchBookCandidate` above — so this just pulls fields straight off
 * the already-selected search result, same merge-don't-overwrite rule
 * and genre-merge as `applyFilmOrTvMatch`. */
async function applyBookMatch(state: MatchState): Promise<'updated' | 'skipped'> {
  if (!state.selectedId) return 'skipped';
  const match = state.candidates.find((c) => c.id === state.selectedId);
  if (!match) return 'skipped';

  const metadata: EntryMetadata = { ...state.entry.metadata };
  let changed = false;
  for (const key of state.missingFields) {
    const value = match.fields[key];
    if (value === undefined) continue;
    metadata[key] = value;
    changed = true;
  }

  const existingGenres = state.entry.genres ?? [];
  const mergedGenres =
    match.genres && match.genres.length > 0
      ? Array.from(new Set([...existingGenres, ...match.genres]))
      : existingGenres;

  if (!changed && mergedGenres.length === existingGenres.length) return 'skipped';

  await updateEntry(state.entry.id, { metadata, genres: mergedGenres });
  return 'updated';
}

/** Applies one resolved match, routing to the right source by media
 * type. Returns whether an update happened. */
export async function applyMatch(state: MatchState): Promise<'updated' | 'skipped'> {
  if (state.status !== 'auto' && state.status !== 'ambiguous') return 'skipped';
  if (state.entry.mediaType === 'comic') return applyComicMatch(state);
  if (state.entry.mediaType === 'book') return applyBookMatch(state);
  return applyFilmOrTvMatch(state);
}
