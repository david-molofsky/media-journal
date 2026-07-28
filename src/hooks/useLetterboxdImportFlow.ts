import { useState } from 'react';
import {
  parseLetterboxdDiary,
  partitionDuplicates,
  matchRow,
  applyRow,
  type LetterboxdMatchState,
} from '@/services/importExport/letterboxdImportService';
import type { SearchResult } from '@/services/metadata/openLibraryService';

export type LetterboxdImportPhase = 'idle' | 'matching' | 'review' | 'importing' | 'done' | 'empty';

/**
 * Owns the "Import from Letterboxd" flow's state and async steps —
 * same shape as useBackfillFlow, kept as a hook so file parsing kicks
 * off from the file input's onChange handler rather than a useEffect.
 */
export function useLetterboxdImportFlow() {
  const [phase, setPhase] = useState<LetterboxdImportPhase>('idle');
  const [matches, setMatches] = useState<LetterboxdMatchState[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ imported: 0, skipped: 0 });

  const start = async (file: File) => {
    setPhase('matching');
    setMatches([]);
    setProgress({ done: 0, total: 0 });

    const text = await file.text();
    const rows = parseLetterboxdDiary(text);
    if (rows.length === 0) {
      setPhase('empty');
      return;
    }

    const { toMatch, duplicates } = await partitionDuplicates(rows);
    setProgress({ done: 0, total: toMatch.length });

    const resolved: LetterboxdMatchState[] = duplicates.map((row) => ({
      row,
      candidates: [],
      status: 'duplicate' as const,
      included: false,
    }));

    // Sequential, one TMDB call at a time — mirrors useBackfillFlow, so
    // a large diary import doesn't burst the API. Cache is shared
    // across the whole run so rewatches of the same film (separate
    // diary rows) only search TMDB once.
    const cache = new Map<string, SearchResult[]>();
    for (const row of toMatch) {
      const match = await matchRow(row, cache);
      resolved.push(match);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setMatches(resolved);
    setPhase('review');
  };

  const pickCandidate = (index: number, tmdbId: string) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: 'ambiguous', selectedId: tmdbId } : m)),
    );
  };

  const skipEntry = (index: number) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: 'skipped', selectedId: undefined } : m)),
    );
  };

  const setImportAnyway = (index: number, value: boolean) => {
    setMatches((prev) => prev.map((m, i) => (i === index ? { ...m, importAnyway: value } : m)));
  };

  /** Tick/untick a single 'auto'-matched row — the "tick box" feature
   * (see chat): previously auto-matched rows had no way to be excluded
   * short of skipping the whole import. */
  const setIncluded = (index: number, value: boolean) => {
    setMatches((prev) => prev.map((m, i) => (i === index ? { ...m, included: value } : m)));
  };

  /** Ticks/unticks every 'auto'-matched row at once. Ambiguous/none
   * rows keep their own per-row controls (pick/skip, import-anyway)
   * rather than being touched by this — they're not "ticked" in the
   * same sense until a choice has been made. */
  const setAllIncluded = (value: boolean) => {
    setMatches((prev) => prev.map((m) => (m.status === 'auto' ? { ...m, included: value } : m)));
  };

  const applyAll = async () => {
    setPhase('importing');
    setProgress({ done: 0, total: matches.length });
    let imported = 0;
    let skipped = 0;
    for (const match of matches) {
      const result = await applyRow(match);
      if (result === 'imported') imported += 1;
      else skipped += 1;
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSummary({ imported, skipped });
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setMatches([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ imported: 0, skipped: 0 });
  };

  return {
    phase,
    matches,
    progress,
    summary,
    start,
    pickCandidate,
    skipEntry,
    setImportAnyway,
    setIncluded,
    setAllIncluded,
    applyAll,
    reset,
  };
}
