import { db } from '@/services/database/db';
import { updateEntry } from '@/services/database/entryService';
import { getSetting } from '@/services/database/settingsService';
import { searchFilms, getFilmDetails, searchTV, getTVDetails } from '@/services/metadata/tmdbService';
import type { SearchResult } from '@/services/metadata/openLibraryService';
import type { MediaEntry, EntryMetadata, MetadataValue } from '@/models';

/**
 * Backfill only ever targets Film/TV (TMDB) — per David's answer when
 * this feature was scoped, Books/Audiobooks (Open Library) are left for
 * a possible future pass rather than bundled in here.
 */
export type BackfillableField =
  | 'overview'
  | 'runtime'
  | 'productionCompany'
  | 'network'
  | 'series'
  | 'tvStatus'
  | 'posterPath';

const FILM_FIELDS: BackfillableField[] = ['overview', 'runtime', 'productionCompany', 'series', 'posterPath'];
// No 'series' for TV — TMDB has no TV equivalent of a film "collection"
// (see tmdbService.ts), so it's never a backfill candidate for TV.
const TV_FIELDS: BackfillableField[] = ['overview', 'runtime', 'network', 'tvStatus', 'posterPath'];

function hasValue(value: MetadataValue): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/** Reads the same Settings > Metadata auto-fill toggles tmdbService
 * reads, so backfill only ever fills what regular auto-fill would have
 * filled. `productionCompany` and `network` share one toggle
 * (`autofillProductionCompany`), same as in tmdbService. */
async function enabledFieldsMap(): Promise<Record<BackfillableField, boolean>> {
  const [overview, runtime, productionCompany, tvStatus, series, poster] = await Promise.all([
    getSetting('autofillOverview', true),
    getSetting('autofillRuntime', true),
    getSetting('autofillProductionCompany', true),
    getSetting('autofillTvStatus', true),
    getSetting('autofillSeries', true),
    getSetting('autofillPoster', false),
  ]);
  return {
    overview,
    runtime,
    productionCompany,
    network: productionCompany,
    series,
    tvStatus,
    posterPath: poster,
  };
}

export interface BackfillCandidate {
  entry: MediaEntry;
  missingFields: BackfillableField[];
}

/** Narrows a selection down to Film/TV entries that are missing at
 * least one currently-enabled field. Everything else (wrong media
 * type, or already fully filled) is silently excluded rather than
 * shown as a zero-work row. */
export async function computeBackfillCandidates(
  selectedIds: string[],
): Promise<BackfillCandidate[]> {
  const entries = (await db.mediaEntries.bulkGet(selectedIds)).filter(
    (e): e is MediaEntry => e !== undefined,
  );
  const enabled = await enabledFieldsMap();

  const candidates: BackfillCandidate[] = [];
  for (const entry of entries) {
    if (entry.mediaType !== 'film' && entry.mediaType !== 'tv') continue;
    const fieldKeys = entry.mediaType === 'film' ? FILM_FIELDS : TV_FIELDS;
    const missingFields = fieldKeys.filter(
      (key) => enabled[key] && !hasValue(entry.metadata[key]),
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
  /** TMDB id of the chosen candidate — set automatically for 'auto',
   * or by the user picking from `candidates` on the confirm screen. */
  selectedId?: string;
}

/** Searches TMDB by title for a single candidate and classifies the
 * result: an exact (case-insensitive) title match with nothing else
 * competing auto-matches with no confirmation needed; anything with
 * multiple close results, or none, needs the person's input. Calls are
 * made one at a time by the caller (a sequential loop, not
 * Promise.all) to avoid bursting the TMDB API on a large selection. */
export async function matchCandidate(candidate: BackfillCandidate): Promise<MatchState> {
  const { entry, missingFields } = candidate;
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

/** Applies one resolved match: fetches TMDB details, then writes only
 * the fields that were actually missing (never overwrites anything
 * already present, and never touches a field this entry didn't need)
 * plus merges any genre guesses, same merge-don't-overwrite rule as
 * regular auto-fill. Returns whether an update happened. */
export async function applyMatch(state: MatchState): Promise<'updated' | 'skipped'> {
  if (state.status !== 'auto' && state.status !== 'ambiguous') return 'skipped';
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
