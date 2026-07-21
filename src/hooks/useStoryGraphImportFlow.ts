import { useState } from 'react';
import {
  parseStoryGraphLibrary,
  classifyRows,
  applyRow,
  type StoryGraphRow,
  type StoryGraphRowState,
} from '@/services/importExport/storyGraphImportService';

export type StoryGraphImportPhase = 'idle' | 'review' | 'importing' | 'done' | 'empty';

/**
 * Owns the "Import from StoryGraph" flow's state and steps — same
 * shape as useGoodreadsImportFlow, minus the shelf-selection step:
 * StoryGraph's Read Status values map 1:1 onto Media Journal's status
 * system (with did-not-finish folding into in_progress), so there's no
 * ambiguity to ask about — parsing goes straight to review.
 */
export function useStoryGraphImportFlow() {
  const [phase, setPhase] = useState<StoryGraphImportPhase>('idle');
  const [rows, setRows] = useState<StoryGraphRowState[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ imported: 0, skipped: 0 });

  const start = async (file: File) => {
    const text = await file.text();
    const parsed: StoryGraphRow[] = parseStoryGraphLibrary(text);
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

  return { phase, rows, progress, summary, start, setCompletedDate, skipEntry, applyAll, reset };
}
