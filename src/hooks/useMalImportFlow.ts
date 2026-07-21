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
    const needsReview = classified.some((r) => r.status === 'needs_date');
    if (needsReview) {
      setPhase('review');
    } else {
      await runImport(classified);
    }
  };

  const setCompletedDate = (index: number, date: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, completedDate: date } : r)));
  };

  const skipRow = (index: number) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, status: 'skipped', completedDate: undefined } : r)));
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
    confirmReview,
    reset,
  };
}
