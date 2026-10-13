import { useState } from 'react';
import type { EntryStatus } from '@/models';
import {
  applyLibbyRow,
  classifyLibbyRows,
  parseLibbyTimeline,
  type LibbyRowState,
} from '@/services/importExport/libbyImportService';
import { runEntryWriteTransaction } from '@/services/database/entryService';
import {
  trackImportCompleted,
  trackImportFailed,
  trackImportStarted,
} from '@/services/analytics/importAnalytics';

export type LibbyImportPhase =
  'idle' | 'review' | 'importing' | 'done' | 'empty' | 'error';

export function useLibbyImportFlow() {
  const [phase, setPhase] = useState<LibbyImportPhase>('idle');
  const [rows, setRows] = useState<LibbyRowState[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ imported: 0, updated: 0, skipped: 0 });
  const [error, setError] = useState('');

  const start = async (file: File) => {
    trackImportStarted('libby', 'json');
    setError('');
    try {
      const parsed = parseLibbyTimeline(await file.text());
      if (parsed.length === 0) {
        setPhase('empty');
        return;
      }
      setRows(await classifyLibbyRows(parsed));
      setPhase('review');
    } catch (caught) {
      trackImportFailed('libby', 'json', 'parse');
      setError(
        caught instanceof Error ? caught.message : 'Could not read that Libby export.',
      );
      setPhase('error');
    }
  };

  const patchRow = (index: number, patch: Partial<LibbyRowState>) => {
    setRows((previous) =>
      previous.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const setEntryStatus = (index: number, entryStatus: EntryStatus) => {
    patchRow(index, {
      entryStatus,
      completedDate: entryStatus === 'completed' ? '' : undefined,
    });
  };

  const setMediaType = (index: number, mediaType: string) => {
    setRows((previous) =>
      previous.map((state, i) => {
        if (i !== index) return state;
        return { ...state, row: { ...state.row, mediaType } };
      }),
    );
  };

  const setIncluded = (index: number, included: boolean) => patchRow(index, { included });
  const setAllIncluded = (included: boolean) => {
    setRows((previous) =>
      previous.map((row) => (row.status === 'duplicate' ? row : { ...row, included })),
    );
  };

  const applyAll = async () => {
    setPhase('importing');
    setProgress({ done: 0, total: rows.length });
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    await runEntryWriteTransaction(async () => {
      for (const row of rows) {
        const result = await applyLibbyRow(row);
        if (result === 'imported') imported += 1;
        else if (result === 'updated') updated += 1;
        else skipped += 1;
        setProgress((previous) => ({ ...previous, done: previous.done + 1 }));
      }
    });
    setSummary({ imported, updated, skipped });
    trackImportCompleted('libby', 'json', {
      itemsFound: rows.length,
      itemsImported: imported,
      itemsSkipped: skipped,
    });
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ imported: 0, updated: 0, skipped: 0 });
    setError('');
  };

  return {
    phase,
    rows,
    progress,
    summary,
    error,
    start,
    setEntryStatus,
    setCompletedDate: (index: number, completedDate: string) =>
      patchRow(index, { completedDate }),
    setMediaType,
    setIncluded,
    setAllIncluded,
    applyAll,
    reset,
  };
}
