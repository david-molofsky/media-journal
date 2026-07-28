import { useState } from 'react';
import {
  fetchAndClassifyTrakt,
  applyTraktImport,
  type TraktReviewData,
  type TraktFetchProgress,
  type TraktImportSummary,
} from '@/services/importExport/traktImportService';

export type TraktImportPhase = 'idle' | 'fetching' | 'review' | 'importing' | 'done' | 'error';

const EMPTY_DATA: TraktReviewData = {
  movies: [],
  duplicateMovieCount: 0,
  shows: [],
  watchlist: [],
  duplicateWatchlistCount: 0,
};

const EMPTY_SUMMARY: TraktImportSummary = {
  moviesImported: 0,
  moviesSkipped: 0,
  moviesErrored: 0,
  seasonsImported: 0,
  showsErrored: 0,
  watchlistImported: 0,
  watchlistSkipped: 0,
  watchlistErrored: 0,
};

/**
 * Owns the "Sync Trakt" flow's state — fetch → review → apply, the
 * "tick box" feature (see chat). Previously (runTraktImport) fetched
 * and created entries in a single pass with no review step at all;
 * this hook is the retrofit, following the same shape as
 * useNetflixImportFlow/useAmazonPrimeImportFlow, minus the TMDB
 * title-matching step, since Trakt already supplies TMDB ids directly.
 */
export function useTraktImportFlow() {
  const [phase, setPhase] = useState<TraktImportPhase>('idle');
  const [data, setData] = useState<TraktReviewData>(EMPTY_DATA);
  const [fetchProgress, setFetchProgress] = useState<TraktFetchProgress>({ phase: 'movies', done: 0, total: 0 });
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<TraktImportSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPhase('fetching');
    setData(EMPTY_DATA);
    setError(null);
    try {
      const result = await fetchAndClassifyTrakt((p) => setFetchProgress(p));
      setData(result);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong fetching your Trakt data.');
      setPhase('error');
    }
  };

  const toggleMovieIncluded = (key: string) => {
    setData((prev) => ({
      ...prev,
      movies: prev.movies.map((m) => (m.key === key ? { ...m, included: !m.included } : m)),
    }));
  };

  const toggleWatchlistIncluded = (key: string) => {
    setData((prev) => ({
      ...prev,
      watchlist: prev.watchlist.map((w) => (w.key === key ? { ...w, included: !w.included } : w)),
    }));
  };

  const toggleSeason = (key: string, seasonNumber: number) => {
    setData((prev) => ({
      ...prev,
      shows: prev.shows.map((s) => {
        if (s.key !== key) return s;
        const next = new Set(s.includedSeasons);
        if (next.has(seasonNumber)) next.delete(seasonNumber);
        else next.add(seasonNumber);
        return { ...s, includedSeasons: next };
      }),
    }));
  };

  /** Ticks/unticks every movie, watchlist item, and evidenced season
   * of every show at once. */
  const setAllIncluded = (value: boolean) => {
    setData((prev) => ({
      ...prev,
      movies: prev.movies.map((m) => ({ ...m, included: value })),
      watchlist: prev.watchlist.map((w) => ({ ...w, included: value })),
      shows: prev.shows.map((s) => ({
        ...s,
        includedSeasons: value ? new Set(s.seasonEvidence.keys()) : new Set(),
      })),
    }));
  };

  const applyAll = async () => {
    setPhase('importing');
    setApplyProgress({ done: 0, total: 0 });
    const result = await applyTraktImport(data, (p) => setApplyProgress(p));
    setSummary(result);
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setData(EMPTY_DATA);
    setFetchProgress({ phase: 'movies', done: 0, total: 0 });
    setApplyProgress({ done: 0, total: 0 });
    setSummary(EMPTY_SUMMARY);
    setError(null);
  };

  return {
    phase,
    data,
    fetchProgress,
    applyProgress,
    summary,
    error,
    start,
    toggleMovieIncluded,
    toggleWatchlistIncluded,
    toggleSeason,
    setAllIncluded,
    applyAll,
    reset,
  };
}
