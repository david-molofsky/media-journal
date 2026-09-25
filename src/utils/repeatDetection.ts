import type { MediaEntry, NewMediaEntryInput } from '@/models';

const normalize = (value: unknown) =>
  String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/** Require a dated, earlier completion of the same item. */
export function previousConsumption(
  candidate: NewMediaEntryInput,
  entries: MediaEntry[],
): MediaEntry | undefined {
  if (candidate.status !== 'completed' || !candidate.completedDate || !normalize(candidate.title)) return;
  const matches = entries.filter((entry) => {
    if (entry.status !== 'completed' || !entry.completedDate ||
        entry.completedDate >= candidate.completedDate! ||
        entry.mediaType !== candidate.mediaType ||
        normalize(entry.title) !== normalize(candidate.title)) return false;
    const a = candidate.metadata ?? {};
    const b = entry.metadata ?? {};
    if (candidate.mediaType === 'tv' || candidate.mediaType === 'anime') {
      if (a.seasonNumber == null || b.seasonNumber == null ||
          normalize(a.seasonNumber) !== normalize(b.seasonNumber)) return false;
      if (a.episodeStart != null || b.episodeStart != null) {
        if (normalize(a.episodeStart) !== normalize(b.episodeStart) ||
            normalize(a.episodeEnd ?? a.episodeStart) !== normalize(b.episodeEnd ?? b.episodeStart)) return false;
      }
    }
    if (candidate.mediaType === 'comic') {
      if (a.issueStart == null || b.issueStart == null ||
          normalize(a.issueStart) !== normalize(b.issueStart) ||
          normalize(a.issueEnd ?? a.issueStart) !== normalize(b.issueEnd ?? b.issueStart)) return false;
    }
    return true;
  });
  return matches.sort((a, b) => b.completedDate!.localeCompare(a.completedDate!))[0];
}
