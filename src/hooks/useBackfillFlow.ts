import { useState } from 'react';
import {
  computeBackfillCandidates,
  matchCandidate,
  applyMatch,
  type MatchState,
} from '@/services/metadata/backfillService';

export type BackfillPhase = 'idle' | 'searching' | 'review' | 'applying' | 'done' | 'empty';

/**
 * Owns the bulk "Back-fill missing fields" flow's state and async
 * steps. Kept as a hook (rather than local state inside a dialog
 * reacting to an `open` prop) so the search is kicked off from a plain
 * event handler — the Back-fill button's onClick — instead of a
 * useEffect, per React's own guidance against calling setState from
 * inside an effect body.
 */
export function useBackfillFlow() {
  const [phase, setPhase] = useState<BackfillPhase>('idle');
  const [matches, setMatches] = useState<MatchState[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ updated: 0, skipped: 0 });

  const start = async (selectedIds: string[]) => {
    setPhase('searching');
    setMatches([]);
    setProgress({ done: 0, total: 0 });

    const candidates = await computeBackfillCandidates(selectedIds);
    if (candidates.length === 0) {
      setPhase('empty');
      return;
    }
    setProgress({ done: 0, total: candidates.length });

    // Sequential, one TMDB call at a time — not Promise.all — so a
    // large selection doesn't burst the API.
    const resolved: MatchState[] = [];
    for (const candidate of candidates) {
      const match = await matchCandidate(candidate);
      resolved.push(match);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setMatches(resolved);
    setPhase('review');
  };

  const pickCandidate = (index: number, tmdbId: string) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: 'ambiguous', selectedId: tmdbId } : m)),
    );
  };

  const skipEntry = (index: number) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: 'skipped', selectedId: undefined } : m)),
    );
  };

  const applyAll = async () => {
    setPhase('applying');
    setProgress({ done: 0, total: matches.length });
    let updated = 0;
    let skipped = 0;
    for (const match of matches) {
      const result = await applyMatch(match);
      if (result === 'updated') updated += 1;
      else skipped += 1;
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSummary({ updated, skipped });
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setMatches([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ updated: 0, skipped: 0 });
  };

  return { phase, matches, progress, summary, start, pickCandidate, skipEntry, applyAll, reset };
}
