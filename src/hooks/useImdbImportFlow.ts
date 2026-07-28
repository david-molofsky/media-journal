import { useState } from 'react';
import {
  parseImdbRatings,
  matchRows,
  applyMovies,
  applyShowSeasons,
  type ImdbRow,
  type MovieMatch,
  type ShowGroup,
  type SkippedRow,
} from '@/services/importExport/imdbImportService';

export type ImdbImportPhase =
  | 'idle'
  | 'matching'
  | 'review'
  | 'show_prompt'
  | 'importing'
  | 'done'
  | 'empty';

interface Summary {
  filmsImported: number;
  seasonsImported: number;
  skipped: SkippedRow[];
  /** Seasons a person explicitly checked but that had no derivable
   * date and so couldn't be created — see applyShowSeasons. */
  seasonsMissingDate: number;
}

/**
 * Owns the "Import from IMDb" flow's state and steps. Shaped like
 * useLetterboxdImportFlow/useGoodreadsImportFlow (logic hook,
 * everything async started from event handlers rather than effects),
 * plus a show_prompt phase neither of those needed — IMDb rates
 * episodes/shows rather than seasons, so TV rows go through a
 * one-card-at-a-time review (with progress dots — see wireframe)
 * before anything TV-related is created, distinct from the batch
 * review screen movies get.
 */
export function useImdbImportFlow() {
  const [phase, setPhase] = useState<ImdbImportPhase>('idle');
  const [matchProgress, setMatchProgress] = useState({ done: 0, total: 0 });
  const [movies, setMovies] = useState<MovieMatch[]>([]);
  const [showGroups, setShowGroups] = useState<ShowGroup[]>([]);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);
  const [showIndex, setShowIndex] = useState(0);
  // showId -> selected season numbers, built up as the person goes
  // through each show's card. All unchecked by default (see chat).
  const [selections, setSelections] = useState<Map<string, Set<number>>>(new Map());
  const [skippedShowIds, setSkippedShowIds] = useState<Set<string>>(new Set());
  // imdbId -> excluded from import, via the review screen's per-movie
  // checkboxes (the "tick box" feature — see chat). Empty by default,
  // meaning every matched movie starts ticked/included; this only
  // tracks the ones a person explicitly unticked, rather than an
  // "included" set that would need pre-populating with every movie's
  // id up front.
  const [excludedMovies, setExcludedMovies] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<Summary>({
    filmsImported: 0,
    seasonsImported: 0,
    skipped: [],
    seasonsMissingDate: 0,
  });

  const start = async (file: File) => {
    const text = await file.text();
    const rows: ImdbRow[] = parseImdbRatings(text);
    if (rows.length === 0) {
      setPhase('empty');
      return;
    }

    setPhase('matching');
    setMatchProgress({ done: 0, total: rows.length });
    const result = await matchRows(rows, (done, total) => setMatchProgress({ done, total }));

    if (result.movies.length === 0 && result.showGroups.length === 0) {
      setSkipped(result.skipped);
      setPhase('empty');
      return;
    }

    setMovies(result.movies);
    setShowGroups(result.showGroups);
    setSkipped(result.skipped);
    setPhase('review');
  };

  /** Does the actual entry creation. `skippedOverride` lets a caller in
   * the same tick as a just-made "skip this show" decision pass the
   * up-to-date skip set directly, rather than reading `skippedShowIds`
   * state — which wouldn't yet reflect that skip, since setState from
   * the same event handler doesn't apply until the next render (see
   * chat: this raced and silently dropped the final show's skip). */
  const runImport = async (skippedOverride?: Set<string>) => {
    const effectiveSkipped = skippedOverride ?? skippedShowIds;
    setPhase('importing');
    const includedMovies = movies.filter((m) => !excludedMovies.has(m.row.imdbId));
    const totalSteps = includedMovies.length + showGroups.length;
    setImportProgress({ done: 0, total: totalSteps });

    const filmsImported = await applyMovies(includedMovies);
    let done = includedMovies.length;
    setImportProgress({ done, total: totalSteps });

    let seasonsImported = 0;
    let seasonsMissingDate = 0;
    for (const group of showGroups) {
      if (!effectiveSkipped.has(group.tmdbShowId)) {
        const selected = selections.get(group.tmdbShowId) ?? new Set<number>();
        const result = await applyShowSeasons(group, selected);
        seasonsImported += result.imported;
        seasonsMissingDate += result.skippedSeasons.length;
      }
      done += 1;
      setImportProgress({ done, total: totalSteps });
    }

    setSummary({ filmsImported, seasonsImported, skipped, seasonsMissingDate });
    setPhase('done');
  };

  const beginShowPrompts = async () => {
    if (showGroups.length > 0) {
      setShowIndex(0);
      setPhase('show_prompt');
    } else {
      await runImport();
    }
  };

  const toggleSeason = (showId: string, seasonNumber: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(showId) ?? []);
      if (current.has(seasonNumber)) current.delete(seasonNumber);
      else current.add(seasonNumber);
      next.set(showId, current);
      return next;
    });
  };

  const toggleMovieIncluded = (imdbId: string) => {
    setExcludedMovies((prev) => {
      const next = new Set(prev);
      if (next.has(imdbId)) next.delete(imdbId);
      else next.add(imdbId);
      return next;
    });
  };

  /** Select all/Deselect all for the movie list — shows keep their own
   * per-season checkboxes on the show_prompt cards, untouched by this. */
  const setAllMoviesIncluded = (value: boolean) => {
    setExcludedMovies(value ? new Set() : new Set(movies.map((m) => m.row.imdbId)));
  };

  /** Handles both the "Next"/"Import" button (skip=false) and "Skip
   * this show" button (skip=true) — on the last card either one
   * triggers the actual import, computing the final skip set inline
   * rather than via the skippedShowIds state (see runImport's doc). */
  const finishShow = async (showId: string, skip: boolean) => {
    const nextSkippedShowIds = skip ? new Set(skippedShowIds).add(showId) : skippedShowIds;
    if (skip) setSkippedShowIds(nextSkippedShowIds);

    const nextIndex = showIndex + 1;
    if (nextIndex >= showGroups.length) {
      await runImport(nextSkippedShowIds);
    } else {
      setShowIndex(nextIndex);
    }
  };

  const reset = () => {
    setPhase('idle');
    setMatchProgress({ done: 0, total: 0 });
    setMovies([]);
    setShowGroups([]);
    setSkipped([]);
    setShowIndex(0);
    setSelections(new Map());
    setSkippedShowIds(new Set());
    setExcludedMovies(new Set());
    setImportProgress({ done: 0, total: 0 });
    setSummary({ filmsImported: 0, seasonsImported: 0, skipped: [], seasonsMissingDate: 0 });
  };

  return {
    phase,
    matchProgress,
    movies,
    showGroups,
    skipped,
    showIndex,
    selections,
    skippedShowIds,
    excludedMovies,
    importProgress,
    summary,
    start,
    beginShowPrompts,
    toggleSeason,
    toggleMovieIncluded,
    setAllMoviesIncluded,
    finishShow,
    reset,
  };
}
