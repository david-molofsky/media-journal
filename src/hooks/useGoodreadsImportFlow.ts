import { useState } from 'react';
import {
  parseGoodreadsLibrary,
  classifyRows,
  applyRow,
  type GoodreadsRow,
  type GoodreadsRowState,
} from '@/services/importExport/goodreadsImportService';
import type { EntryStatus } from '@/models';

export type GoodreadsImportPhase = 'idle' | 'select_shelves' | 'review' | 'importing' | 'done' | 'empty';

/** All three shelves selected, every time — deliberately not persisted
 * between imports (see chat), unlike the Timeline type filter which
 * uses the same "start from everything on" pattern for a different
 * reason (no state to remember at all, here vs. an explicit choice not
 * to remember one). */
const ALL_STATUSES: EntryStatus[] = ['completed', 'in_progress', 'wishlist'];

/**
 * Owns the "Import from Goodreads" flow's state and steps — same shape
 * as useLetterboxdImportFlow, minus the sequential TMDB-matching phase:
 * Goodreads' export needs no external lookup for title/author/dates/
 * rating, so parsing goes straight to a shelf-selection step, then
 * review.
 */
export function useGoodreadsImportFlow() {
  const [phase, setPhase] = useState<GoodreadsImportPhase>('idle');
  const [rawRows, setRawRows] = useState<GoodreadsRow[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EntryStatus>>(new Set(ALL_STATUSES));
  const [emptyReason, setEmptyReason] = useState<'no_rows' | 'no_selection_match'>('no_rows');
  const [rows, setRows] = useState<GoodreadsRowState[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ imported: 0, skipped: 0 });

  const start = async (file: File) => {
    const text = await file.text();
    const parsed = parseGoodreadsLibrary(text);
    if (parsed.length === 0) {
      setEmptyReason('no_rows');
      setPhase('empty');
      return;
    }
    setRawRows(parsed);
    setSelectedStatuses(new Set(ALL_STATUSES));
    setPhase('select_shelves');
  };

  const toggleStatus = (status: EntryStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const confirmShelves = async () => {
    const filtered = rawRows.filter((r) => selectedStatuses.has(r.status));
    if (filtered.length === 0) {
      setEmptyReason('no_selection_match');
      setPhase('empty');
      return;
    }
    const classified = await classifyRows(filtered);
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

  /** Tick/untick a single 'ready' row — the "tick box" feature (see
   * chat). 'needs_date' rows use skipEntry/setCompletedDate instead. */
  const setIncluded = (index: number, value: boolean) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, included: value } : r)));
  };

  const setAllIncluded = (value: boolean) => {
    setRows((prev) => prev.map((r) => (r.status === 'ready' ? { ...r, included: value } : r)));
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
    setRawRows([]);
    setSelectedStatuses(new Set(ALL_STATUSES));
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ imported: 0, skipped: 0 });
  };

  return {
    phase,
    selectedStatuses,
    emptyReason,
    rows,
    progress,
    summary,
    start,
    toggleStatus,
    confirmShelves,
    setCompletedDate,
    skipEntry,
    setIncluded,
    setAllIncluded,
    applyAll,
    reset,
  };
}
