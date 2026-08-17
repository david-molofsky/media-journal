import type { MediaType } from '@/models';
import type { ReSearchResult } from '@/services/metadata/reSearchService';
import { toTitleCase } from './toTitleCase';

export interface ReSearchFieldDiff {
  key: string;
  label: string;
  oldDisplay: string;
  newDisplay: string;
}

export interface ReSearchDiffSet {
  titleDiff: { oldValue: string; newValue: string } | null;
  fieldDiffs: ReSearchFieldDiff[];
  /** Genres present in the fresh result but not already on the entry.
   * Always additive, never a removal/replace — see ReSearchDialog. */
  genreAdds: string[];
  hasDiffs: boolean;
}

function displayValue(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '—';
  return String(raw);
}

/**
 * Compares a Re-search result against the entry's current form values,
 * field by field, and reports only what actually differs — used to
 * decide between showing the confirm dialog and the "already up to
 * date" toast (see ReSearchDialog / EntryForm's Re-search button).
 *
 * Deliberately only walks `mediaType.fields` (the user-visible ones):
 * bespoke keys like `overview`, `posterPath`, `tmdbId` etc. aren't
 * declared there, so they never produce a diff row here — EntryForm
 * applies those silently alongside whatever the user does check,
 * exactly like a normal MetadataSearch fill would.
 */
export function computeReSearchDiffs(
  mediaType: MediaType,
  currentTitle: string,
  currentMetadata: Record<string, unknown>,
  currentGenres: string[],
  result: ReSearchResult,
): ReSearchDiffSet {
  const newTitle = result.title ? toTitleCase(result.title) : '';
  const titleDiff =
    newTitle && newTitle !== currentTitle ? { oldValue: currentTitle, newValue: newTitle } : null;

  const fieldDiffs: ReSearchFieldDiff[] = [];
  for (const fieldDef of mediaType.fields) {
    const rawNew = result.fields[fieldDef.key];
    if (rawNew === undefined || rawNew === '') continue;

    const coercedNew = fieldDef.type === 'number' ? String(Number(rawNew)) : toTitleCase(rawNew);
    const oldRaw = currentMetadata[fieldDef.key];
    if (String(oldRaw ?? '') === coercedNew) continue; // unchanged

    fieldDiffs.push({
      key: fieldDef.key,
      label: fieldDef.label,
      oldDisplay: displayValue(oldRaw),
      newDisplay: coercedNew,
    });
  }

  const genreAdds = (result.genres ?? []).filter((g) => !currentGenres.includes(g));

  return {
    titleDiff,
    fieldDiffs,
    genreAdds,
    hasDiffs: Boolean(titleDiff) || fieldDiffs.length > 0 || genreAdds.length > 0,
  };
}
