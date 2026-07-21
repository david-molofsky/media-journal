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
 *
 * Flow is split into classify → review → apply (mirroring the
 * StoryGraph import's needs_date pattern): MAL sometimes marks
 * something 'completed' without ever recording a finish_date (common
 * on older list entries), but this app requires a completed date
 * whenever status is 'completed'. Rather than silently guessing a
 * date or downgrading the status, these rows are surfaced for the
 * person to fill in a date (pre-filled with start_date as a
 * suggestion where available) or explicitly skip.
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
  const metadata: EntryMetadata = { malId: String(node.id), source: 'MyAnimeList' };
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
  const metadata: EntryMetadata = { malId: String(node.id), source: 'MyAnimeList' };
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

export type MalRowStatus = 'ready' | 'needs_date' | 'duplicate' | 'skipped';

export interface MalRowState {
  entry: MalListEntry;
  mediaType: 'anime' | 'manga';
  status: MalRowStatus;
  /** MJ status this row resolves to (completed/in_progress/wishlist) —
   * fixed once classified, doesn't change even if the person edits
   * completedDate in the review step. */
  resolvedStatus: EntryStatus;
  /** Only meaningful when resolvedStatus === 'completed'. Pre-filled
   * from MAL's finish_date when present (status: 'ready'), or from
   * start_date as a suggestion when finish_date is missing (status:
   * 'needs_date') — editable in the review UI either way. */
  completedDate?: string;
}

function classifyEntry(
  entry: MalListEntry,
  mediaType: 'anime' | 'manga',
  existingIds: Set<string>,
): MalRowState {
  const malId = String(entry.node.id);
  if (existingIds.has(malId)) {
    return { entry, mediaType, status: 'duplicate', resolvedStatus: 'completed' };
  }

  const resolvedStatus = statusForMalStatus(entry.list_status.status);
  if (resolvedStatus !== 'completed') {
    return { entry, mediaType, status: 'ready', resolvedStatus };
  }

  const finishDate = entry.list_status.finish_date;
  if (finishDate) {
    return { entry, mediaType, status: 'ready', resolvedStatus, completedDate: finishDate };
  }

  // Completed with no finish_date — needs the person to confirm or
  // supply one, rather than silently guessing (see chat). start_date
  // is offered as a pre-filled suggestion, not applied automatically.
  return {
    entry,
    mediaType,
    status: 'needs_date',
    resolvedStatus,
    completedDate: entry.list_status.start_date || undefined,
  };
}

export interface MalFetchProgress {
  phase: 'anime' | 'manga';
  fetched: number;
}

/** Fetches and classifies both lists (anime then manga), without
 * creating any entries yet. Returns every row — duplicates included —
 * so the caller can show accurate counts; `applyMalRow` is a no-op for
 * duplicate/skipped rows. */
export async function fetchAndClassifyMal(
  onProgress?: (progress: MalFetchProgress) => void,
): Promise<MalRowState[]> {
  const [animeList, existingAnimeIds] = await Promise.all([
    fetchMalList('anime', (count) => onProgress?.({ phase: 'anime', fetched: count })),
    loadExistingMalIds('anime'),
  ]);
  const animeRows = animeList.map((entry) => classifyEntry(entry, 'anime', existingAnimeIds));

  const [mangaList, existingMangaIds] = await Promise.all([
    fetchMalList('manga', (count) => onProgress?.({ phase: 'manga', fetched: count })),
    loadExistingMalIds('manga'),
  ]);
  const mangaRows = mangaList.map((entry) => classifyEntry(entry, 'manga', existingMangaIds));

  return [...animeRows, ...mangaRows];
}

/** Creates the MJ entry for one resolved row. Returns 'skipped' for
 * duplicates, explicitly-skipped rows, or needs_date rows the person
 * never filled in a date for. Each call is independent — a single
 * malformed row (validation failure despite the checks above) is
 * caught and counted as skipped rather than aborting the whole run
 * (see chat: this exact class of bug used to kill the entire import
 * over one bad entry). */
export async function applyMalRow(state: MalRowState): Promise<'imported' | 'skipped'> {
  if (state.status === 'duplicate' || state.status === 'skipped') return 'skipped';
  if (state.resolvedStatus === 'completed' && !state.completedDate) return 'skipped';

  const { entry, mediaType, resolvedStatus, completedDate } = state;
  const rewatchCount =
    mediaType === 'anime' ? entry.list_status.num_times_rewatched : entry.list_status.num_times_reread;

  try {
    await createEntry({
      title: entry.node.title,
      mediaType,
      status: resolvedStatus,
      completedDate,
      startedDate: entry.list_status.start_date || undefined,
      rating: entry.list_status.score > 0 ? entry.list_status.score : undefined,
      repeatConsumption: (rewatchCount ?? 0) > 0,
      tags: buildTags(rewatchCount, mediaType),
      genres: entry.node.genres?.map((g) => g.name) ?? [],
      metadata: mediaType === 'anime' ? buildAnimeMetadata(entry) : buildMangaMetadata(entry),
    });
    return 'imported';
  } catch {
    return 'skipped';
  }
}
