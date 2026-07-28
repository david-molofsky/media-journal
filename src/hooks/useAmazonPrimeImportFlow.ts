import { useState } from 'react';
import {
  parseAmazonPrimeCsv,
  matchAmazonPrimeRows,
  applyAmazonPrimeImport,
  type ReviewItem,
  type ApplyResult,
} from '@/services/importExport/amazonPrimeImportService';

export type AmazonPrimeImportPhase = 'idle' | 'matching' | 'review' | 'importing' | 'done' | 'empty';

/**
 * Owns the "Import from Amazon Prime Video" flow's state and async
 * steps — identical shape to useNetflixImportFlow (same ReviewItem
 * model, same review/tick step), just calling the Amazon Prime
 * service's parse/match/apply functions instead.
 */
export function useAmazonPrimeImportFlow() {
  const [phase, setPhase] = useState<AmazonPrimeImportPhase>('idle');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ApplyResult>({
    moviesImported: 0,
    seasonsImported: 0,
    flaggedForReview: 0,
    unmatched: 0,
  });

  const start = async (file: File) => {
    setPhase('matching');
    setItems([]);
    setProgress({ done: 0, total: 0 });

    const text = await file.text();
    const rows = parseAmazonPrimeCsv(text);
    if (rows.length === 0) {
      setPhase('empty');
      return;
    }

    setProgress({ done: 0, total: rows.length });
    const resolved = await matchAmazonPrimeRows(rows, (done, total) => setProgress({ done, total }));
    setItems(resolved);
    setPhase('review');
  };

  const pickMovieCandidate = (key: string, tmdbId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.kind === 'movie' && item.key === key
          ? { ...item, status: 'ambiguous', selectedId: tmdbId, included: true }
          : item,
      ),
    );
  };

  const skipMovie = (key: string) => {
    setItems((prev) =>
      prev.map((item) => (item.kind === 'movie' && item.key === key ? { ...item, status: 'skipped' } : item)),
    );
  };

  const setMovieIncluded = (key: string, value: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.kind === 'movie' && item.key === key ? { ...item, included: value } : item)),
    );
  };

  const pickShowCandidate = (key: string, tmdbId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.kind === 'show' && item.key === key ? { ...item, selectedId: tmdbId } : item)),
    );
  };

  const toggleSeason = (key: string, seasonNumber: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.kind !== 'show' || item.key !== key) return item;
        const next = new Set(item.includedSeasons);
        if (next.has(seasonNumber)) next.delete(seasonNumber);
        else next.add(seasonNumber);
        return { ...item, includedSeasons: next };
      }),
    );
  };

  const setAllIncluded = (value: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.kind === 'movie') {
          if (item.status === 'duplicate' || item.status === 'skipped') return item;
          return { ...item, included: value };
        }
        if (item.status === 'none') return item;
        return { ...item, includedSeasons: value ? new Set(item.seasonEvidence.keys()) : new Set() };
      }),
    );
  };

  const applyAll = async () => {
    setPhase('importing');
    const result = await applyAmazonPrimeImport(items);
    setSummary(result);
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setItems([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ moviesImported: 0, seasonsImported: 0, flaggedForReview: 0, unmatched: 0 });
  };

  return {
    phase,
    items,
    progress,
    summary,
    start,
    pickMovieCandidate,
    skipMovie,
    setMovieIncluded,
    pickShowCandidate,
    toggleSeason,
    setAllIncluded,
    applyAll,
    reset,
  };
}
