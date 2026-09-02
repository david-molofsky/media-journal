import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import {
  findByImdbId,
  getFilmDetails,
  getTVDetails,
  searchFilms,
  searchTV,
} from '@/services/metadata/tmdbService';
import { searchBooks } from '@/services/metadata/openLibraryService';
import { getPlayedItems } from '@/services/metadata/jellyfinService';
import { getSetting } from '@/services/database/settingsService';
import { fuzzyMatchTitle, type ExternalReviewItem } from './externalMediaReview';
import { importedFromTag } from '@/utils/importedFromTag';
import { toTitleCase } from '@/utils/toTitleCase';
import { SETTINGS_KEYS } from '@/models';
import type { EntryMetadata } from '@/models';

const SOURCE = 'Jellyfin';

/** Jellyfin item type -> Media Journal media type. Books/Audiobooks
 * are already distinct types in Jellyfin itself (see jellyfinService.ts),
 * so no format/library classification step is needed here, unlike
 * Audiobookshelf. */
const TYPE_MAP: Record<string, string> = {
  Movie: 'film',
  Series: 'tv',
  Book: 'book',
  AudioBook: 'audiobook',
};

async function loadExistingKeys(): Promise<Set<string>> {
  const entries = await db.mediaEntries
    .where('mediaType')
    .anyOf('film', 'tv', 'book', 'audiobook')
    .toArray();
  return new Set(entries.map((e) => `${e.mediaType}|${e.title.trim().toLowerCase()}`));
}

export interface JellyfinFetchProgress {
  done: number;
  total: number;
}

/**
 * Fetches every played Movie/Series/Book/AudioBook, matching Movies
 * and Series directly via embedded IMDb/TMDB ids (same as the IMDb
 * import) — Books/AudioBooks have no such ids in Jellyfin (online
 * metadata isn't supported for the Books library type), so those
 * always fall back to a title/author fuzzy search.
 */
export async function fetchJellyfinLibrary(
  onProgress?: (p: JellyfinFetchProgress) => void,
): Promise<ExternalReviewItem[]> {
  const serverUrl = await getSetting(SETTINGS_KEYS.jellyfinServerUrl, '');
  const token = await getSetting(SETTINGS_KEYS.jellyfinToken, '');
  const userId = await getSetting(SETTINGS_KEYS.jellyfinUserId, '');
  if (!serverUrl || !token || !userId) throw new Error('Not connected to Jellyfin.');

  const [rawItems, existingKeys] = await Promise.all([
    getPlayedItems(serverUrl, token, userId, ['Movie', 'Series', 'Book', 'AudioBook']),
    loadExistingKeys(),
  ]);

  const items: ExternalReviewItem[] = [];
  let done = 0;

  for (const raw of rawItems) {
    done += 1;
    onProgress?.({ done, total: rawItems.length });

    const mediaType = TYPE_MAP[raw.Type];
    if (!mediaType) continue; // unsupported/unknown item type — skip

    const dedupeKey = `${mediaType}|${raw.Name.trim().toLowerCase()}`;
    if (existingKeys.has(dedupeKey)) continue;

    let status: ExternalReviewItem['status'] = 'none';
    let candidates: ExternalReviewItem['candidates'] = [];
    let selectedCandidateId: string | undefined;

    if (mediaType === 'film' || mediaType === 'tv') {
      const imdbId = raw.ProviderIds?.['Imdb'];
      const tmdbId = raw.ProviderIds?.['Tmdb'];

      if (tmdbId) {
        status = 'matched';
        selectedCandidateId = tmdbId;
        candidates = [{ id: tmdbId, title: raw.Name }];
      } else if (imdbId) {
        try {
          const found = await findByImdbId(imdbId);
          const resolvedId =
            mediaType === 'film' ? found.movieId : (found.tvId ?? found.episode?.showId);
          if (resolvedId) {
            status = 'matched';
            selectedCandidateId = resolvedId;
            candidates = [{ id: resolvedId, title: raw.Name }];
          }
        } catch {
          // fall through to fuzzy match below
        }
      }

      if (status !== 'matched') {
        const search = mediaType === 'film' ? searchFilms : searchTV;
        const match = await fuzzyMatchTitle(raw.Name, search);
        status = match.status;
        candidates = match.candidates;
        selectedCandidateId = match.selectedCandidateId;
      }
    } else {
      // Book / AudioBook — no provider ids available, straight to fuzzy match.
      const match = await fuzzyMatchTitle(raw.Name, searchBooks);
      status = match.status;
      candidates = match.candidates;
      selectedCandidateId = match.selectedCandidateId;
    }

    const date = raw.UserData?.LastPlayedDate
      ? dayjs(raw.UserData.LastPlayedDate).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD');

    items.push({
      key: raw.Id,
      title: raw.Name,
      subtitle: raw.Album,
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

export interface JellyfinImportSummary {
  imported: number;
  skipped: number;
}

/** Creates entries for every ticked item — only called once the
 * person confirms the review step. Movies/TV pull full metadata from
 * TMDB via the matched id; Books/Audiobooks just carry over title and
 * (if Jellyfin provided one) author. */
export async function applyJellyfinImport(
  items: ExternalReviewItem[],
): Promise<JellyfinImportSummary> {
  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.included || !item.selectedCandidateId) {
      skipped += 1;
      continue;
    }

    if (item.mediaType === 'film' || item.mediaType === 'tv') {
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
        watchedWith: [],
        recommendedBy: [],
        metadata,
      });
    } else {
      const candidate = item.candidates.find((c) => c.id === item.selectedCandidateId);
      const metadata: EntryMetadata = { source: SOURCE };
      if (item.subtitle) metadata['author'] = item.subtitle;
      await createEntry({
        title: candidate?.title ?? toTitleCase(item.title),
        mediaType: item.mediaType,
        status: 'completed',
        completedDate: item.date,
        repeatConsumption: false,
        tags: [importedFromTag(SOURCE)],
        genres: [],
        watchedWith: [],
        recommendedBy: [],
        metadata,
      });
    }
    imported += 1;
  }

  return { imported, skipped };
}
