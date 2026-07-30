import { useState } from 'react';
import {
  fetchPlexLibrary,
  applyPlexImport,
  type PlexFetchProgress,
  type PlexImportSummary,
} from '@/services/importExport/plexImportService';
import type { ExternalReviewItem } from '@/services/importExport/externalMediaReview';

export type PlexImportPhase = 'idle' | 'fetching' | 'review' | 'importing' | 'done' | 'error';

const EMPTY_SUMMARY: PlexImportSummary = { imported: 0, skipped: 0 };

/** Owns the "Sync Plex" flow: fetch → review (tick-box) → apply. Same
 * no-threshold shape as Jellyfin — viewCount > 0 is already a clean
 * signal. */
export function usePlexImportFlow() {
  const [phase, setPhase] = useState<PlexImportPhase>('idle');
  const [data, setData] = useState<ExternalReviewItem[]>([]);
  const [fetchProgress, setFetchProgress] = useState<PlexFetchProgress>({ done: 0, total: 0 });
  const [summary, setSummary] = useState<PlexImportSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPhase('fetching');
    setFetchProgress({ done: 0, total: 0 });
    setError(null);
    try {
      const result = await fetchPlexLibrary((p) => setFetchProgress(p));
      setData(result);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong fetching your Plex library.');
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
    const result = await applyPlexImport(data);
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
