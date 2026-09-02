import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { lookupByIsbn, searchBooks } from '@/services/metadata/openLibraryService';
import {
  getMediaProgress,
  getLibraryItem,
  getLibraries,
  type AbsLibraryItem,
} from '@/services/metadata/audiobookshelfService';
import { getSetting } from '@/services/database/settingsService';
import { fuzzyMatchTitle, type ExternalReviewItem } from './externalMediaReview';
import { importedFromTag } from '@/utils/importedFromTag';
import { toTitleCase } from '@/utils/toTitleCase';
import { SETTINGS_KEYS } from '@/models';
import type { EntryMetadata } from '@/models';

const SOURCE = 'Audiobookshelf';

async function loadExistingKeys(): Promise<Set<string>> {
  const entries = await db.mediaEntries
    .where('mediaType')
    .anyOf('book', 'audiobook')
    .toArray();
  return new Set(entries.map((e) => `${e.mediaType}|${e.title.trim().toLowerCase()}`));
}

/**
 * Combines file format and library name to guess Book vs Audiobook
 * (see chat: "both signals combined, picker if ambiguous"). Flags
 * `ambiguous` whenever the two signals disagree, or when there's no
 * clean format signal at all (mixed-format item) — the review screen
 * shows a picker for anything ambiguous, pre-selected to the best
 * guess so nothing is silently misfiled if the person doesn't touch it.
 */
function classify(
  item: AbsLibraryItem,
  libraryName: string,
): { mediaType: 'book' | 'audiobook'; ambiguous: boolean } {
  const hasAudio = (item.media.audioFiles?.length ?? 0) > 0;
  const hasEbook = Boolean(item.media.ebookFormat);
  const librarySignal: 'book' | 'audiobook' = /audio/i.test(libraryName)
    ? 'audiobook'
    : 'book';

  const formatSignal: 'book' | 'audiobook' | undefined =
    hasAudio && !hasEbook ? 'audiobook' : !hasAudio && hasEbook ? 'book' : undefined;

  if (formatSignal)
    return { mediaType: formatSignal, ambiguous: formatSignal !== librarySignal };
  return { mediaType: librarySignal, ambiguous: true };
}

export interface AbsFetchProgress {
  done: number;
  total: number;
}

/**
 * Fetches every Audiobookshelf item at or above `minProgress` (0–1,
 * the person's chosen threshold — see AudiobookshelfImportSection),
 * classifies each as Book or Audiobook, and matches it to Open
 * Library: ISBN direct lookup first (reuses the same lookupByIsbn used
 * by barcode scanning), falling back to a title/author fuzzy search.
 * Items already in the library (by mediaType + title) are dropped
 * before matching even runs, same as Trakt's duplicate handling.
 */
export async function fetchAudiobookshelfLibrary(
  minProgress: number,
  onProgress?: (p: AbsFetchProgress) => void,
): Promise<ExternalReviewItem[]> {
  const serverUrl = await getSetting(SETTINGS_KEYS.absServerUrl, '');
  const token = await getSetting(SETTINGS_KEYS.absToken, '');
  if (!serverUrl || !token) throw new Error('Not connected to Audiobookshelf.');

  const [progressList, libraries, existingKeys] = await Promise.all([
    getMediaProgress(serverUrl, token),
    getLibraries(serverUrl, token),
    loadExistingKeys(),
  ]);
  const libraryNameById = new Map(libraries.map((l) => [l.id, l.name]));

  const eligible = progressList.filter((p) => p.progress >= minProgress);
  const items: ExternalReviewItem[] = [];
  let done = 0;

  for (const progress of eligible) {
    done += 1;
    onProgress?.({ done, total: eligible.length });

    let detail: AbsLibraryItem;
    try {
      detail = await getLibraryItem(serverUrl, token, progress.libraryItemId);
    } catch {
      continue; // item may have been removed from the server since
    }

    const { title, authorName, isbn } = detail.media.metadata;
    const libraryName = libraryNameById.get(detail.libraryId) ?? '';
    const { mediaType, ambiguous } = classify(detail, libraryName);

    const dedupeKey = `${mediaType}|${title.trim().toLowerCase()}`;
    if (existingKeys.has(dedupeKey)) continue;

    let status: ExternalReviewItem['status'] = 'none';
    let candidates: ExternalReviewItem['candidates'] = [];
    let selectedCandidateId: string | undefined;

    if (isbn) {
      try {
        const result = await lookupByIsbn(isbn);
        if (result) {
          status = 'matched';
          selectedCandidateId = result.id;
          candidates = [{ id: result.id, title: result.title }];
        }
      } catch {
        // fall through to fuzzy match below
      }
    }
    if (status !== 'matched') {
      const match = await fuzzyMatchTitle(title, searchBooks);
      status = match.status;
      candidates = match.candidates;
      selectedCandidateId = match.selectedCandidateId;
    }

    const date = progress.finishedAt
      ? new Date(progress.finishedAt).toISOString().slice(0, 10)
      : progress.startedAt
        ? new Date(progress.startedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    items.push({
      key: progress.libraryItemId,
      title,
      subtitle: authorName,
      mediaType,
      status,
      candidates,
      selectedCandidateId,
      date,
      included: status !== 'none',
      typeChoice: ambiguous
        ? {
            options: [
              { value: 'book', label: 'Book' },
              { value: 'audiobook', label: 'Audiobook' },
            ],
            selected: mediaType,
          }
        : undefined,
    });
  }

  return items;
}

export interface AbsImportSummary {
  imported: number;
  skipped: number;
}

/** Creates entries for every ticked item — only called once the
 * person confirms the review step. `typeChoice.selected` (if the
 * person changed it) wins over the auto-classified `mediaType`. */
export async function applyAudiobookshelfImport(
  items: ExternalReviewItem[],
): Promise<AbsImportSummary> {
  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.included) {
      skipped += 1;
      continue;
    }

    const mediaType = item.typeChoice?.selected ?? item.mediaType;
    const candidate = item.candidates.find((c) => c.id === item.selectedCandidateId);
    const metadata: EntryMetadata = { source: SOURCE };
    if (item.subtitle) metadata['author'] = item.subtitle;

    await createEntry({
      title: candidate?.title ?? toTitleCase(item.title),
      mediaType,
      status: 'completed',
      completedDate: item.date,
      repeatConsumption: false,
      tags: [importedFromTag(SOURCE)],
      genres: [],
      watchedWith: [],
      recommendedBy: [],
      metadata,
    });
    imported += 1;
  }

  return { imported, skipped };
}
