import { useState } from 'react';
import {
  fetchJellyfinLibrary,
  applyJellyfinImport,
  type JellyfinFetchProgress,
  type JellyfinImportSummary,
} from '@/services/importExport/jellyfinImportService';
import type { ExternalReviewItem } from '@/services/importExport/externalMediaReview';

export type JellyfinImportPhase = 'idle' | 'fetching' | 'review' | 'importing' | 'done' | 'error';

const EMPTY_SUMMARY: JellyfinImportSummary = { imported: 0, skipped: 0 };

/**
 * Owns the "Sync Jellyfin" flow: fetch → review (tick-box) → apply.
 * No threshold step — Jellyfin already has a clean played:true flag,
 * unlike Audiobookshelf (see useAudiobookshelfImportFlow).
 */
export function useJellyfinImportFlow() {
  const [phase, setPhase] = useState<JellyfinImportPhase>('idle');
  const [data, setData] = useState<ExternalReviewItem[]>([]);
  const [fetchProgress, setFetchProgress] = useState<JellyfinFetchProgress>({ done: 0, total: 0 });
  const [summary, setSummary] = useState<JellyfinImportSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPhase('fetching');
    setFetchProgress({ done: 0, total: 0 });
    setError(null);
    try {
      const result = await fetchJellyfinLibrary((p) => setFetchProgress(p));
      setData(result);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong fetching your Jellyfin library.');
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

  const setAllIncluded = (value: boolean) => {
    setData((prev) => prev.map((item) => ({ ...item, included: value })));
  };

  const applyAll = async () => {
    setPhase('importing');
    const result = await applyJellyfinImport(data);
    setSummary(result);
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setData([]);
    setFetchProgress({ done: 0, total: 0 });
    setSummary(EMPTY_SUMMARY);
    setError(null);
  };

  return {
    phase,
    data,
    fetchProgress,
    summary,
    error,
    start,
    toggleIncluded,
    selectCandidate,
    setAllIncluded,
    applyAll,
    reset,
  };
}
