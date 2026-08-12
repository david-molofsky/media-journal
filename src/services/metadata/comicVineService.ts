/**
 * ComicVine metadata lookup for Comic Issues.
 *
 * ComicVine's API sends no CORS headers, so this goes through a small
 * Cloudflare Worker proxy that holds the actual API key server-side
 * (see /mnt/user-data/outputs/comicvine-worker.js delivered separately —
 * that file lives in Cloudflare's dashboard, not this repo). This
 * service only ever talks to the Worker, never to ComicVine directly.
 *
 * ComicVine attribution: data provided by comicvine.gamespot.com.
 *
 * Two-call flow, unlike TMDB's title search:
 *   1. `searchSeries` — searches ComicVine's `volume` resource by name.
 *      Selecting a result fills Series + Publisher immediately (both
 *      already present on the volume search result — no second call
 *      needed), matching the "fields already populated" fast path
 *      MetadataSearch.tsx already uses for Open Library.
 *   2. `getIssueDetails` — a *separate* action (a button in EntryForm,
 *      not part of MetadataSearch) that runs once both a series has
 *      been selected and an issue number has been typed. ComicVine's
 *      search/list endpoints don't return credits — only the singular
 *      issue detail endpoint does — so this is deliberately a second,
 *      explicit step rather than an automatic follow-up call.
 */

import type { SearchResult } from './openLibraryService';
import { getSetting } from '@/services/database/settingsService';
export type { SearchResult };

// ── Config ───────────────────────────────────────────────────────────────────

// Public by design — this is Claude/David's Cloudflare Worker, not
// ComicVine itself. The Worker holds the real ComicVine API key as an
// encrypted secret and only accepts requests from this app's own
// origins (see the Worker's ALLOWED_ORIGINS allowlist).
const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

async function comicVineGet<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_BASE}${path}`);
  if (!res.ok) throw new Error(`ComicVine proxy error ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Series (ComicVine "volume") search ──────────────────────────────────────

interface ComicVinePublisher {
  name: string;
}

interface ComicVineVolumeSearchResult {
  id: number;
  name: string;
  publisher?: ComicVinePublisher;
  start_year?: string;
}

/**
 * Searches ComicVine for a series (volume) by name. Publisher comes
 * free on this same call, so it — along with Series itself — is filled
 * immediately on selection with no follow-up request. The volume's
 * numeric id is smuggled through as `fields.comicVineVolumeId`; it's
 * not a real metadata field (EntryForm intercepts and strips it before
 * writing to the entry) — it's just how the id travels from this
 * search step to the later `getIssueDetails` step.
 */
function mapVolume(volume: ComicVineVolumeSearchResult, autofillPublisher: boolean): SearchResult {
  const fields: Record<string, string> = {
    series: volume.name,
    comicVineVolumeId: String(volume.id),
  };
  if (autofillPublisher && volume.publisher?.name) {
    fields['publisher'] = volume.publisher.name;
  }
  return {
    id: String(volume.id),
    title: volume.name,
    subtitle: [volume.publisher?.name, volume.start_year].filter(Boolean).join(' · '),
    fields,
  };
}

export async function searchSeries(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const data = await comicVineGet<{ results: ComicVineVolumeSearchResult[] }>(
    `/search/?resources=volume&query=${encodeURIComponent(query)}&field_list=id,name,publisher,start_year&limit=15`,
  );

  const autofillPublisher = await getSetting('autofillComicPublisher', true);

  return data.results.slice(0, 15).map((volume) => mapVolume(volume, autofillPublisher));
}

/**
 * Infinite-scroll variant used by MetadataSearch.tsx — fetches the
 * next 15-result batch starting at `offset` and reports whether a
 * further batch would still return anything, per ComicVine's own
 * `number_of_total_results`. See matching comment on
 * tmdbService.ts's `searchFilmsPage` for why this is a separate
 * function rather than a new param on `searchSeries`.
 */
export async function searchSeriesPage(
  query: string,
  offset: number,
): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  if (!query.trim()) return { results: [], hasMore: false };

  const data = await comicVineGet<{
    results: ComicVineVolumeSearchResult[];
    number_of_total_results: number;
  }>(
    `/search/?resources=volume&query=${encodeURIComponent(query)}&field_list=id,name,publisher,start_year&limit=15&offset=${offset}`,
  );

  const autofillPublisher = await getSetting('autofillComicPublisher', true);
  const results = data.results.map((volume) => mapVolume(volume, autofillPublisher));

  return { results, hasMore: offset + results.length < data.number_of_total_results };
}

// ── Issue detail (credits, cover date, cover image) ─────────────────────────

interface ComicVinePersonCredit {
  name: string;
  role: string | null;
}

interface ComicVineImage {
  medium_url?: string;
  small_url?: string;
}

interface ComicVineIssueDetail {
  name: string | null;
  cover_date: string | null;
  person_credits?: ComicVinePersonCredit[];
  image?: ComicVineImage;
}

/** Maps ComicVine's free-text credit roles (a person can hold several,
 * comma-separated, e.g. "penciler, inker, cover") onto this app's
 * creator field keys. `artist` is ComicVine's catch-all for a single
 * penciler/inker credit and is folded into both fields — common on
 * creator-owned/indie books where one person draws the whole page. */
const ROLE_FIELD_MAP: Array<{ match: RegExp; fieldKeys: string[] }> = [
  { match: /writer|plot|script/i, fieldKeys: ['writer'] },
  { match: /pencil/i, fieldKeys: ['penciller'] },
  { match: /inker|finishes/i, fieldKeys: ['inker'] },
  { match: /colorist|color/i, fieldKeys: ['colorist'] },
  { match: /letterer/i, fieldKeys: ['letterer'] },
  { match: /cover/i, fieldKeys: ['coverArtist'] },
  { match: /editor/i, fieldKeys: ['editor'] },
  { match: /artist/i, fieldKeys: ['penciller', 'inker'] },
];

/**
 * Finds the issue matching `issueNumber` within a given series
 * (`volumeId`), then fetches its full detail — credits, cover date,
 * cover image. Two ComicVine calls: a filtered list call to find the
 * issue's own resource URL (list calls don't return credits), then the
 * singular issue endpoint. Returns `{ fields: {} }` if no issue in
 * that series matches the given number, rather than throwing — callers
 * treat an empty result as "no match found", not an error.
 */
export async function getIssueDetails(
  volumeId: string,
  issueNumber: string,
): Promise<{ fields: Record<string, string> }> {
  const matchData = await comicVineGet<{ results: Array<{ api_detail_url: string }> }>(
    `/issues/?filter=volume:${volumeId},issue_number:${issueNumber}&field_list=api_detail_url&limit=1`,
  );
  const match = matchData.results[0];
  if (!match?.api_detail_url) return { fields: {} };

  // The singular issue endpoint needs ComicVine's resource-type-prefixed
  // id (e.g. "4000-409326"), not the plain numeric id — rather than
  // hardcode that prefix, reuse the full path ComicVine already gave us.
  const detailPath = match.api_detail_url.replace('https://comicvine.gamespot.com/api', '');
  const detail = await comicVineGet<{ results: ComicVineIssueDetail }>(
    `${detailPath}?field_list=name,cover_date,person_credits,image`,
  );
  const issue = detail.results;

  const [
    autofillIssueTitle,
    autofillCoverDate,
    autofillWriter,
    autofillPenciller,
    autofillInker,
    autofillColorist,
    autofillLetterer,
    autofillCoverArtist,
    autofillEditor,
    autofillCoverImage,
  ] = await Promise.all([
    getSetting('autofillComicIssueTitle', true),
    getSetting('autofillComicCoverDate', true),
    getSetting('autofillComicWriter', true),
    getSetting('autofillComicPenciller', true),
    getSetting('autofillComicInker', true),
    getSetting('autofillComicColorist', true),
    getSetting('autofillComicLetterer', true),
    getSetting('autofillComicCoverArtist', true),
    getSetting('autofillComicEditor', true),
    getSetting('autofillComicCoverImage', true),
  ]);

  const fields: Record<string, string> = {};
  if (autofillIssueTitle && issue.name) fields['issueTitle'] = issue.name;
  if (autofillCoverDate && issue.cover_date) fields['coverDate'] = issue.cover_date;

  const creditsByField = new Map<string, Set<string>>();
  for (const credit of issue.person_credits ?? []) {
    if (!credit.role) continue;
    for (const roleFragment of credit.role.split(',')) {
      const mapping = ROLE_FIELD_MAP.find((r) => r.match.test(roleFragment));
      if (!mapping) continue;
      for (const fieldKey of mapping.fieldKeys) {
        if (!creditsByField.has(fieldKey)) creditsByField.set(fieldKey, new Set());
        creditsByField.get(fieldKey)?.add(credit.name);
      }
    }
  }

  const creatorToggles: Record<string, boolean> = {
    writer: autofillWriter,
    penciller: autofillPenciller,
    inker: autofillInker,
    colorist: autofillColorist,
    letterer: autofillLetterer,
    coverArtist: autofillCoverArtist,
    editor: autofillEditor,
  };
  for (const [fieldKey, names] of creditsByField) {
    if (creatorToggles[fieldKey] && names.size > 0) {
      fields[fieldKey] = Array.from(names).join(', ');
    }
  }

  // Cover image stores ComicVine's own hosted URL directly — unlike
  // TMDB, ComicVine's `image` object returns full URLs rather than a
  // relative path to combine with a separate base URL.
  if (autofillCoverImage) {
    const imageUrl = issue.image?.medium_url ?? issue.image?.small_url;
    if (imageUrl) fields['coverImagePath'] = imageUrl;
  }

  return { fields };
}

// ── Find Next in Series ─────────────────────────────────────────────────────
// See chat (Aug 2026).

/**
 * Comic's "next in series". Entries don't persist ComicVine's numeric
 * volume id (see mapVolume's comment above — it only ever travels
 * transiently through EntryForm), so unlike Book/TV/Film this always
 * re-resolves the volume by searching the stored `series` text first,
 * taking the first (best) match, then reuses `getIssueDetails` for the
 * actual issue+1 lookup — same two-call shape that function already
 * has. Returns `null` if the series text finds no ComicVine volume, or
 * the target issue number doesn't exist within it.
 */
export async function findNextComicIssue(
  seriesName: string,
  targetIssueNumber: number,
): Promise<{ title: string; fields: Record<string, string> } | null> {
  const volumeMatches = await searchSeries(seriesName);
  const volumeId = volumeMatches[0]?.fields.comicVineVolumeId;
  if (!volumeId) return null;

  const { fields } = await getIssueDetails(volumeId, String(targetIssueNumber));
  if (Object.keys(fields).length === 0) return null;

  return {
    title: fields.issueTitle || `${seriesName} #${targetIssueNumber}`,
    fields: {
      ...fields,
      series: seriesName,
      issueStart: String(targetIssueNumber),
      comicVineVolumeId: volumeId,
    },
  };
}
