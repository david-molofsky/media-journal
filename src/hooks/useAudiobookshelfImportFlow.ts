import { useState } from 'react';
import {
  fetchAudiobookshelfLibrary,
  applyAudiobookshelfImport,
  type AbsFetchProgress,
  type AbsImportSummary,
} from '@/services/importExport/audiobookshelfImportService';
import type { ExternalReviewItem } from '@/services/importExport/externalMediaReview';

export type AbsImportPhase = 'idle' | 'threshold' | 'fetching' | 'review' | 'importing' | 'done' | 'error';

const DEFAULT_THRESHOLD = 0.9;

const EMPTY_SUMMARY: AbsImportSummary = { imported: 0, skipped: 0 };

/**
 * Owns the "Sync Audiobookshelf" flow: pick a progress threshold →
 * fetch → review (tick-box, same shape as Trakt's) → apply. The one
 * step none of the other imports have is 'threshold' — Audiobookshelf
 * has no clean "finished" boolean the way Jellyfin/Plex do, so the
 * person picks a minimum progress % each time they sync (see chat).
 */
export function useAudiobookshelfImportFlow() {
  const [phase, setPhase] = useState<AbsImportPhase>('idle');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [data, setData] = useState<ExternalReviewItem[]>([]);
  const [fetchProgress, setFetchProgress] = useState<AbsFetchProgress>({ done: 0, total: 0 });
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<AbsImportSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);

  const begin = () => {
    setPhase('threshold');
    setError(null);
  };

  const fetchLibrary = async () => {
    setPhase('fetching');
    setFetchProgress({ done: 0, total: 0 });
    try {
      const result = await fetchAudiobookshelfLibrary(threshold, (p) => setFetchProgress(p));
      setData(result);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong fetching your Audiobookshelf library.');
      setPhase('error');
    }
  };

  const toggleIncluded = (key: string) => {
    setData((prev) => prev.map((item) => (item.key === key ? { ...item, included: !item.included } : item)));
  };

  const selectCandidate = (key: string, candidateId: string) => {
    setData((prev) =>
      prev.map((item) => (item.key === key ? { ...item, selectedCandidateId: candidateId } : item)),
    );
  };

  const selectType = (key: string, value: string) => {
    setData((prev) =>
      prev.map((item) =>
        item.key === key && item.typeChoice
          ? { ...item, mediaType: value, typeChoice: { ...item.typeChoice, selected: value } }
          : item,
      ),
    );
  };

  const setAllIncluded = (value: boolean) => {
    setData((prev) => prev.map((item) => ({ ...item, included: value })));
  };

  const applyAll = async () => {
    setPhase('importing');
    setApplyProgress({ done: 0, total: data.length });
    const result = await applyAudiobookshelfImport(data);
    setSummary(result);
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setThreshold(DEFAULT_THRESHOLD);
    setData([]);
    setFetchProgress({ done: 0, total: 0 });
    setApplyProgress({ done: 0, total: 0 });
    setSummary(EMPTY_SUMMARY);
    setError(null);
  };

  return {
    phase,
    threshold,
    setThreshold,
    data,
    fetchProgress,
    applyProgress,
    summary,
    error,
    begin,
    fetchLibrary,
    toggleIncluded,
    selectCandidate,
    selectType,
    setAllIncluded,
    applyAll,
    reset,
  };
}
