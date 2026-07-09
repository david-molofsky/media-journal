import { useState } from 'react';
import {
  parseGoodreadsLibrary,
  classifyRows,
  applyRow,
  type GoodreadsRowState,
} from '@/services/importExport/goodreadsImportService';

export type GoodreadsImportPhase = 'idle' | 'review' | 'importing' | 'done' | 'empty';

/**
 * Owns the "Import from Goodreads" flow's state and steps — same shape
 * as useLetterboxdImportFlow, minus the sequential TMDB-matching phase:
 * Goodreads' export needs no external lookup for title/author/dates/
 * rating, so parsing goes straight from file selection to review.
 */
export function useGoodreadsImportFlow() {
  const [phase, setPhase] = useState<GoodreadsImportPhase>('idle');
  const [rows, setRows] = useState<GoodreadsRowState[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ imported: 0, skipped: 0 });

  const start = async (file: File) => {
    const text = await file.text();
    const parsed = parseGoodreadsLibrary(text);
    if (parsed.length === 0) {
      setPhase('empty');
      return;
    }
    const classified = await classifyRows(parsed);
    setRows(classified);
    setPhase('review');
  };

  const setCompletedDate = (index: number, date: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, completedDate: date } : r)));
  };

  const skipEntry = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: 'skipped', completedDate: undefined } : r)),
    );
  };

  const applyAll = async () => {
    setPhase('importing');
    setProgress({ done: 0, total: rows.length });
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const result = await applyRow(row);
      if (result === 'imported') imported += 1;
      else skipped += 1;
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSummary({ imported, skipped });
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ imported: 0, skipped: 0 });
  };

  return {
    phase,
    rows,
    progress,
    summary,
    start,
    setCompletedDate,
    skipEntry,
    applyAll,
    reset,
  };
}
