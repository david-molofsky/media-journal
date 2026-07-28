import { useState } from 'react';
import {
  fetchAndClassifyMal,
  applyMalRow,
  type MalRowState,
  type MalFetchProgress,
} from '@/services/importExport/malImportService';

export type MalImportPhase = 'idle' | 'fetching' | 'review' | 'importing' | 'done';

export interface MalImportSummary {
  imported: number;
  skipped: number;
}

/**
 * Owns the MAL import flow's state end to end: fetch + classify both
 * lists, skip straight to importing if nothing needs a date, otherwise
 * show the review step first. Shared between MalCallbackPage (first
 * connection) and MalImportSection's "Sync now" (subsequent syncs) so
 * the date-review behaviour is identical in both places.
 */
export function useMalImportFlow() {
  const [phase, setPhase] = useState<MalImportPhase>('idle');
  const [rows, setRows] = useState<MalRowState[]>([]);
  const [fetchProgress, setFetchProgress] = useState<MalFetchProgress>({ phase: 'anime', fetched: 0 });
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<MalImportSummary>({ imported: 0, skipped: 0 });

  const runImport = async (rowsToImport: MalRowState[]) => {
    setPhase('importing');
    setApplyProgress({ done: 0, total: rowsToImport.length });
    let imported = 0;
    let skipped = 0;
    for (const row of rowsToImport) {
      const result = await applyMalRow(row);
      if (result === 'imported') imported += 1;
      else skipped += 1;
      setApplyProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSummary({ imported, skipped });
    setPhase('done');
  };

  const start = async () => {
    setPhase('fetching');
    const classified = await fetchAndClassifyMal((p) => setFetchProgress(p));
    setRows(classified);
    // Always land on review now — previously this skipped straight to
    // import when nothing needed a date, but that meant 'ready' rows
    // were never reviewable/tickable at all on a clean sync (see
    // chat: the "tick box" feature). One extra tap on a clean sync is
    // the same cost every other import source in this app already
    // has, so this isn't really a regression relative to the rest of
    // MJ — MAL (and Trakt) were the outliers by skipping it.
    setPhase('review');
  };

  const setCompletedDate = (index: number, date: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, completedDate: date } : r)));
  };

  const skipRow = (index: number) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, status: 'skipped', completedDate: undefined } : r)));
  };

  /** Tick/untick a single 'ready' row — the "tick box" feature (see
   * chat). Previously 'ready' rows were never itemized at all when no
   * row needed a date, since the review step was skipped entirely in
   * that case (straight to import) — see the updated `start` below. */
  const setIncluded = (index: number, value: boolean) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, included: value } : r)));
  };

  const setAllIncluded = (value: boolean) => {
    setRows((prev) => prev.map((r) => (r.status === 'ready' ? { ...r, included: value } : r)));
  };

  const confirmReview = () => runImport(rows);

  const reset = () => {
    setPhase('idle');
    setRows([]);
    setFetchProgress({ phase: 'anime', fetched: 0 });
    setApplyProgress({ done: 0, total: 0 });
    setSummary({ imported: 0, skipped: 0 });
  };

  return {
    phase,
    rows,
    fetchProgress,
    applyProgress,
    summary,
    start,
    setCompletedDate,
    skipRow,
    setIncluded,
    setAllIncluded,
    confirmReview,
    reset,
  };
}
