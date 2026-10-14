import { useRef, useState } from 'react';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';
import {
  DisneyPlusReviewDialog,
  type DisneyPlusReviewItem,
} from '@/components/settings/DisneyPlusReviewDialog';
import {
  applyDisneyPlusImport,
  parseDisneyPlusWorkbook,
  type DisneyPlusItem,
  type DisneyPlusPreview,
} from '@/services/importExport/disneyPlusImportService';
import { searchFilms, searchTV } from '@/services/metadata/tmdbService';
import {
  trackImportCompleted,
  trackImportFailed,
  trackImportStarted,
} from '@/services/analytics/importAnalytics';

type Phase = 'idle' | 'matching' | 'review' | 'applying' | 'done' | 'error';

export function DisneyPlusImportSection({
  open,
  onCloseInstructions,
}: {
  open: boolean;
  onCloseInstructions: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [items, setItems] = useState<DisneyPlusReviewItem[]>([]);
  const [preview, setPreview] = useState<DisneyPlusPreview | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);

  const choose = () => ref.current?.click();
  const matchItems = async (rawItems: DisneyPlusItem[]) => {
    const results: DisneyPlusReviewItem[] = [];
    const cache = new Map<string, Awaited<ReturnType<typeof searchFilms>>>();
    for (const item of rawItems) {
      const cacheKey = item.mediaType + '|' + item.title.trim().toLowerCase();
      let candidates = cache.get(cacheKey);
      if (!candidates) {
        candidates = await (item.mediaType === 'film'
          ? searchFilms(item.title)
          : searchTV(item.title));
        cache.set(cacheKey, candidates);
      }
      const exact = candidates.filter(
        (candidate) =>
          candidate.title.trim().toLowerCase() === item.title.trim().toLowerCase(),
      );
      const status: DisneyPlusReviewItem['matchStatus'] =
        exact.length === 1 ? 'auto' : candidates.length ? 'ambiguous' : 'none';
      const selectedId =
        status === 'auto' ? exact[0]!.id : (candidates[0]?.id ?? '__raw__');
      results.push({
        ...item,
        candidates: candidates.slice(0, 5),
        matchStatus: status,
        selectedId,
        included: true,
      });
    }
    return results;
  };

  const fileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError('');
      setPhase('matching');
      const result = await parseDisneyPlusWorkbook(await file.arrayBuffer(), {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setPreview(result.preview);
      const matched = await matchItems(result.items);
      setItems(matched);
      setPhase('review');
      onCloseInstructions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not read this Disney+ export.',
      );
      setPhase('error');
      onCloseInstructions();
    }
  };

  const reset = () => {
    setPhase('idle');
    setItems([]);
    setPreview(null);
    setError('');
    setCount(0);
  };

  const pick = (key: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, selectedId: value } : item)),
    );
  };
  const include = (key: string, included: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, included } : item)),
    );
  };
  const selectAll = (included: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, included })));
  };

  const apply = async () => {
    setPhase('applying');
    trackImportStarted('disney_plus', 'xlsx');
    try {
      const selected = items
        .filter((item) => item.included)
        .map(({ candidates: _candidates, matchStatus: _matchStatus, ...item }) => item);
      const n = await applyDisneyPlusImport(selected);
      setCount(n);
      trackImportCompleted('disney_plus', 'xlsx', {
        itemsFound: preview?.rows ?? 0,
        itemsImported: n,
        itemsSkipped: Math.max(0, items.length - n),
        itemsFlagged: preview?.ignored ?? 0,
      });
      setPhase('done');
    } catch {
      trackImportFailed('disney_plus', 'xlsx', 'apply');
      setError('Import failed. Check your library before retrying.');
      setPhase('error');
    }
  };

  return (
    <>
      <ImportInstructionsDialog
        open={open}
        onClose={onCloseInstructions}
        title="Import from Disney+"
        buttonLabel="Choose Excel file"
        onChoose={choose}
        description={
          <>
            Choose the Disney+ viewing-history .xlsx export. Film playback segments are
            grouped into sessions; TV episodes are grouped by series. Re-imported sessions
            are skipped, and you can review title matches before importing.
          </>
        }
      />
      <input
        ref={ref}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={fileChange}
      />
      <DisneyPlusReviewDialog
        open={phase !== 'idle'}
        phase={phase}
        items={items}
        count={count}
        error={error}
        onPick={pick}
        onInclude={include}
        onSelectAll={selectAll}
        onApply={() => void apply()}
        onClose={reset}
      />
    </>
  );
}
