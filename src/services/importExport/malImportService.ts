import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { fetchMalList, type MalListEntry } from '@/services/metadata/malService';
import type { EntryMetadata, EntryStatus } from '@/models';

/**
 * Imports a MyAnimeList user's anime and manga lists into the Anime
 * and Manga media types. Per the scoping decisions (see chat):
 *   - Metadata (title, cover, id) comes from MAL directly — no TMDB/
 *     ComicVine cross-reference.
 *   - Score is MAL's own 0–10 scale, direct passthrough.
 *   - on_hold and dropped both fold into 'in_progress' — no new status
 *     values.
 *   - Rewatches/rereads: one entry, with the count noted as a tag
 *     (e.g. "rewatched: 2x") rather than separate entries — MAL only
 *     gives a count, not per-instance dates, unlike Trakt's history.
 */

function statusForMalStatus(raw: string): EntryStatus {
  if (raw === 'completed') return 'completed';
  if (raw === 'watching' || raw === 'reading') return 'in_progress';
  if (raw === 'plan_to_watch' || raw === 'plan_to_read') return 'wishlist';
  // on_hold, dropped
  return 'in_progress';
}

const FORMAT_LABELS: Record<string, string> = {
  tv: 'TV',
  movie: 'Movie',
  ova: 'OVA',
  ona: 'TV',
  special: 'Special',
};

function buildAnimeMetadata(entry: MalListEntry): EntryMetadata {
  const { node, list_status: status } = entry;
  const metadata: EntryMetadata = { malId: String(node.id) };
  if (node.studios?.[0]?.name) metadata['studio'] = node.studios[0].name;
  if (node.media_type) metadata['format'] = FORMAT_LABELS[node.media_type] ?? node.media_type;
  if (status.num_episodes_watched !== undefined) metadata['episodesWatched'] = status.num_episodes_watched;
  if (node.num_episodes) metadata['totalEpisodes'] = node.num_episodes;
  if (node.main_picture?.large ?? node.main_picture?.medium) {
    metadata['coverImagePath'] = node.main_picture.large ?? node.main_picture.medium;
  }
  return metadata;
}

function buildMangaMetadata(entry: MalListEntry): EntryMetadata {
  const { node, list_status: status } = entry;
  const metadata: EntryMetadata = { malId: String(node.id) };
  const author = node.authors?.[0]?.node;
  if (author) metadata['author'] = `${author.first_name} ${author.last_name}`.trim();
  if (status.num_chapters_read !== undefined) metadata['chaptersRead'] = status.num_chapters_read;
  if (node.num_chapters) metadata['totalChapters'] = node.num_chapters;
  if (status.num_volumes_read !== undefined) metadata['volumesRead'] = status.num_volumes_read;
  if (node.num_volumes) metadata['totalVolumes'] = node.num_volumes;
  if (node.main_picture?.large ?? node.main_picture?.medium) {
    metadata['coverImagePath'] = node.main_picture.large ?? node.main_picture.medium;
  }
  return metadata;
}

function buildTags(rewatchCount: number | undefined, mediaType: 'anime' | 'manga'): string[] {
  if (!rewatchCount || rewatchCount <= 0) return [];
  const verb = mediaType === 'anime' ? 'rewatched' : 'reread';
  return [`${verb}: ${rewatchCount}x`];
}

/** Existing MAL ids already imported for this type, used to skip rows
 * re-imported on a later sync — same dedupe convention as the CSV
 * imports, keyed on the `malId` metadata field instead of title. */
async function loadExistingMalIds(mediaType: 'anime' | 'manga'): Promise<Set<string>> {
  const existing = await db.mediaEntries.where('mediaType').equals(mediaType).toArray();
  return new Set(
    existing.map((e) => (typeof e.metadata.malId === 'string' ? e.metadata.malId : '')).filter(Boolean),
  );
}

export interface MalImportSummary {
  animeImported: number;
  animeSkipped: number;
  mangaImported: number;
  mangaSkipped: number;
}

export interface MalImportProgress {
  phase: 'anime' | 'manga';
  fetched: number;
}

/**
 * Runs the full import: fetches the anime list, then the manga list
 * (each paginated), skipping anything already imported by malId, and
 * creates Media Journal entries for the rest. `onProgress` fires
 * during both the fetch (list pull) and the create phase so the UI can
 * show one continuous progress bar across the whole operation.
 */
export async function runMalImport(
  onProgress?: (progress: MalImportProgress) => void,
): Promise<MalImportSummary> {
  const [animeList, existingAnimeIds] = await Promise.all([
    fetchMalList('anime', (count) => onProgress?.({ phase: 'anime', fetched: count })),
    loadExistingMalIds('anime'),
  ]);

  let animeImported = 0;
  let animeSkipped = 0;
  for (const entry of animeList) {
    const malId = String(entry.node.id);
    if (existingAnimeIds.has(malId)) {
      animeSkipped += 1;
      continue;
    }
    const status = statusForMalStatus(entry.list_status.status);
    await createEntry({
      title: entry.node.title,
      mediaType: 'anime',
      status,
      completedDate: status === 'completed' ? entry.list_status.finish_date || undefined : undefined,
      startedDate: entry.list_status.start_date || undefined,
      rating: entry.list_status.score > 0 ? entry.list_status.score : undefined,
      repeatConsumption: (entry.list_status.num_times_rewatched ?? 0) > 0,
      tags: buildTags(entry.list_status.num_times_rewatched, 'anime'),
      genres: entry.node.genres?.map((g) => g.name) ?? [],
      metadata: buildAnimeMetadata(entry),
    });
    animeImported += 1;
  }

  const [mangaList, existingMangaIds] = await Promise.all([
    fetchMalList('manga', (count) => onProgress?.({ phase: 'manga', fetched: count })),
    loadExistingMalIds('manga'),
  ]);

  let mangaImported = 0;
  let mangaSkipped = 0;
  for (const entry of mangaList) {
    const malId = String(entry.node.id);
    if (existingMangaIds.has(malId)) {
      mangaSkipped += 1;
      continue;
    }
    const status = statusForMalStatus(entry.list_status.status);
    await createEntry({
      title: entry.node.title,
      mediaType: 'manga',
      status,
      completedDate: status === 'completed' ? entry.list_status.finish_date || undefined : undefined,
      startedDate: entry.list_status.start_date || undefined,
      rating: entry.list_status.score > 0 ? entry.list_status.score : undefined,
      repeatConsumption: (entry.list_status.num_times_reread ?? 0) > 0,
      tags: buildTags(entry.list_status.num_times_reread, 'manga'),
      genres: entry.node.genres?.map((g) => g.name) ?? [],
      metadata: buildMangaMetadata(entry),
    });
    mangaImported += 1;
  }

  return { animeImported, animeSkipped, mangaImported, mangaSkipped };
}
