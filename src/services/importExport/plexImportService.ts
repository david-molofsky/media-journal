import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { findByImdbId, getFilmDetails, getTVDetails, searchFilms, searchTV } from '@/services/metadata/tmdbService';
import {
  getLibrarySections,
  getWatchedItems,
  extractPlexIds,
  type PlexItem,
} from '@/services/metadata/plexService';
import { getSetting } from '@/services/database/settingsService';
import { fuzzyMatchTitle, type ExternalReviewItem } from './externalMediaReview';
import { importedFromTag } from '@/utils/importedFromTag';
import { SETTINGS_KEYS } from '@/models';
import type { EntryMetadata } from '@/models';

const SOURCE = 'Plex';

async function loadExistingKeys(): Promise<Set<string>> {
  const entries = await db.mediaEntries.where('mediaType').anyOf('film', 'tv').toArray();
  return new Set(entries.map((e) => `${e.mediaType}|${e.title.trim().toLowerCase()}`));
}

export interface PlexFetchProgress {
  done: number;
  total: number;
}

/**
 * Fetches every watched Movie/Show across every Movie/Show library
 * section, matching directly via Plex's embedded TMDB/IMDb ids (same
 * as the IMDb import), falling back to a title/year fuzzy search for
 * anything without one.
 */
export async function fetchPlexLibrary(
  onProgress?: (p: PlexFetchProgress) => void,
): Promise<ExternalReviewItem[]> {
  const serverUrl = await getSetting(SETTINGS_KEYS.plexServerUrl, '');
  const token = await getSetting(SETTINGS_KEYS.plexToken, '');
  if (!serverUrl || !token) throw new Error('Not connected to Plex.');

  const [sections, existingKeys] = await Promise.all([getLibrarySections(serverUrl, token), loadExistingKeys()]);
  const mediaSections = sections.filter((s) => s.type === 'movie' || s.type === 'show');

  const rawItems: { item: PlexItem; mediaType: string }[] = [];
  for (const section of mediaSections) {
    const mediaType = section.type === 'movie' ? 'film' : 'tv';
    const watched = await getWatchedItems(serverUrl, token, section.key);
    for (const item of watched) rawItems.push({ item, mediaType });
  }

  const items: ExternalReviewItem[] = [];
  let done = 0;

  for (const { item: raw, mediaType } of rawItems) {
    done += 1;
    onProgress?.({ done, total: rawItems.length });

    const dedupeKey = `${mediaType}|${raw.title.trim().toLowerCase()}`;
    if (existingKeys.has(dedupeKey)) continue;

    let status: ExternalReviewItem['status'] = 'none';
    let candidates: ExternalReviewItem['candidates'] = [];
    let selectedCandidateId: string | undefined;

    const { tmdbId, imdbId } = extractPlexIds(raw);
    if (tmdbId) {
      status = 'matched';
      selectedCandidateId = tmdbId;
      candidates = [{ id: tmdbId, title: raw.title }];
    } else if (imdbId) {
      try {
        const found = await findByImdbId(imdbId);
        const resolvedId = mediaType === 'film' ? found.movieId : found.tvId ?? found.episode?.showId;
        if (resolvedId) {
          status = 'matched';
          selectedCandidateId = resolvedId;
          candidates = [{ id: resolvedId, title: raw.title }];
        }
      } catch {
        // fall through to fuzzy match below
      }
    }

    if (status !== 'matched') {
      const search = mediaType === 'film' ? searchFilms : searchTV;
      const match = await fuzzyMatchTitle(raw.title, search);
      status = match.status;
      candidates = match.candidates;
      selectedCandidateId = match.selectedCandidateId;
    }

    const date = raw.lastViewedAt ? dayjs.unix(raw.lastViewedAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

    items.push({
      key: raw.ratingKey,
      title: raw.title,
      mediaType,
      status,
      candidates,
      selectedCandidateId,
      date,
      included: status !== 'none',
    });
  }

  return items;
}

export interface PlexImportSummary {
  imported: number;
  skipped: number;
}

/** Creates entries for every ticked item — only called once the
 * person confirms the review step. Always pulls full metadata from
 * TMDB via the matched id, same as the IMDb import. */
export async function applyPlexImport(items: ExternalReviewItem[]): Promise<PlexImportSummary> {
  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.included || !item.selectedCandidateId) {
      skipped += 1;
      continue;
    }

    const details =
      item.mediaType === 'film'
        ? await getFilmDetails(item.selectedCandidateId)
        : await getTVDetails(item.selectedCandidateId);
    const metadata: EntryMetadata = { source: SOURCE };
    for (const [key, value] of Object.entries(details.fields)) {
      metadata[key] = key === 'runtime' ? Number(value) : value;
    }

    await createEntry({
      title: details.title || item.title,
      mediaType: item.mediaType,
      status: 'completed',
      completedDate: item.date,
      repeatConsumption: false,
      tags: [importedFromTag(SOURCE)],
      genres: details.genres ?? [],
      metadata,
    });
    imported += 1;
  }

  return { imported, skipped };
}
