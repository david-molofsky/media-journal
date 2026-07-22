/**
 * UPC barcode lookup for Comics (single issues), via UPCitemdb
 * (https://upcitemdb.com). Unlike Films (UPCMDB returns an IMDb id for
 * a direct TMDB match), UPCitemdb has no comics-specific database — it
 * returns a general retailer-style listing title (e.g. "Amazing
 * Spider-Man #1 (2022) Marvel Comics"), which has to be parsed and
 * fuzzy-matched against ComicVine's series search. Expect this to be
 * meaningfully less reliable than the Films or ISBN flows — see chat.
 *
 * Uses UPCitemdb's free trial tier (100 requests/day, no signup or key
 * required) via the Worker proxy — still needed despite no key, since
 * UPCitemdb doesn't send CORS headers. See upc-worker-routes.js.
 */

import { searchSeries, getIssueDetails } from './comicVineService';
import type { SearchResult } from './openLibraryService';

const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

// ── UPCitemdb lookup ─────────────────────────────────────────────────────────

export type UpcitemdbLookupResult =
  | { status: 'found'; title: string }
  /** UPCitemdb has no record of this UPC (empty `items` array). */
  | { status: 'not-found' }
  /** Network error, non-200, or malformed response. */
  | { status: 'service-error' };

interface UpcitemdbItem {
  title?: string;
}
interface UpcitemdbResponse {
  code: string;
  total: number;
  items?: UpcitemdbItem[];
}

async function lookupUpcitemdbListing(upc: string): Promise<UpcitemdbLookupResult> {
  try {
    const res = await fetch(`${WORKER_BASE}/upcitemdb/${encodeURIComponent(upc)}`);
    if (!res.ok) return { status: 'service-error' };
    const data = (await res.json()) as UpcitemdbResponse;
    const title = data.items?.[0]?.title;
    if (!title) return { status: 'not-found' };
    return { status: 'found', title };
  } catch {
    return { status: 'service-error' };
  }
}

// ── Parsing a retailer-style listing title into series + issue number ───────

/** Publisher names commonly appended at the end of a comics listing
 * title — stripped so what's left is closer to a bare series name.
 * Ordered longest-first so e.g. "Dark Horse Comics" matches before a
 * shorter partial would. Best-effort only; an unmapped or unusual
 * publisher name just stays in the string and mildly dilutes the
 * similarity score rather than breaking anything. */
const PUBLISHER_SUFFIXES = [
  'Dark Horse Comics', 'Dark Horse',
  'IDW Publishing', 'IDW',
  'BOOM! Studios', 'Boom Studios',
  'Dynamite Entertainment', 'Dynamite',
  'Valiant Comics', 'Valiant',
  'Vault Comics',
  'Aftershock Comics',
  'Oni Press',
  'Marvel Comics', 'Marvel',
  'DC Comics', 'DC',
  'Image Comics', 'Image',
];

/** Matches "#12", "#12.1" (half/point issues), "No. 12", "No 12". */
const ISSUE_NUMBER_PATTERN = /#\s*(\d+(?:\.\d+)?)|\bno\.?\s*(\d+(?:\.\d+)?)\b/i;

/** Trailing "(2022)"-style year, with or without a month/other text
 * alongside it — UPCitemdb listings vary in how much they cram into
 * the parenthetical. */
const TRAILING_PAREN_PATTERN = /\([^)]*\b(19|20)\d{2}\b[^)]*\)\s*$/;

export interface ParsedComicListing {
  /** Best-effort series name guess, for fuzzy-matching against
   * ComicVine. Empty string if nothing usable remained after
   * stripping the issue number and known noise. */
  seriesGuess: string;
  /** Null if no issue-number pattern was found in the listing title —
   * common enough (see chat) that callers need to handle it as a
   * normal case, not an error. */
  issueNumber: string | null;
}

export function parseComicListing(rawTitle: string): ParsedComicListing {
  const issueMatch = rawTitle.match(ISSUE_NUMBER_PATTERN);
  const issueNumber = issueMatch ? (issueMatch[1] ?? issueMatch[2] ?? null) : null;

  let remainder = issueMatch ? rawTitle.slice(0, issueMatch.index).trim() : rawTitle.trim();
  remainder = remainder.replace(TRAILING_PAREN_PATTERN, '').trim();

  for (const publisher of PUBLISHER_SUFFIXES) {
    const suffixPattern = new RegExp(`\\s*${publisher.replace('!', '\\!')}\\s*$`, 'i');
    if (suffixPattern.test(remainder)) {
      remainder = remainder.replace(suffixPattern, '').trim();
      break;
    }
  }

  // Trailing separator punctuation left over once the pieces above are
  // stripped (e.g. "Batman -" or "Batman,").
  remainder = remainder.replace(/[-,:]+\s*$/, '').trim();

  return { seriesGuess: remainder, issueNumber };
}

// ── Fuzzy matching against ComicVine series search ──────────────────────────

/** Words too generic to count toward a series-name match — otherwise
 * "The Amazing Spider-Man" vs "The Sensational Spider-Man" would score
 * higher than it should purely on "The" overlapping. */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'vol', 'volume']);

function tokenize(value: string): Set<string> {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return new Set(words);
}

/** Jaccard similarity (intersection / union) on word tokens — simple,
 * dependency-free, and good enough at MVP to separate "clearly this
 * one" from "could be several" from "nothing close." Expect to revisit
 * if real-world scanning shows it misfiring often (abbreviated titles,
 * "Vol. 2" suffixes ComicVine includes that UPCitemdb listings don't,
 * etc. — see chat). */
export function seriesSimilarity(candidateName: string, seriesGuess: string): number {
  const a = tokenize(candidateName);
  const b = tokenize(seriesGuess);
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** A candidate is confidently "the" match if it scores at least this
 * well AND clears the next-best candidate by at least CONFIDENCE_GAP —
 * both conditions matter: a lone 0.3 with nothing else close is still
 * too uncertain to auto-select, and two candidates both scoring 0.9
 * are too close to call automatically either. */
const MIN_CONFIDENT_SCORE = 0.5;
const CONFIDENCE_GAP = 0.25;
/** Below this, a candidate isn't worth showing in the picker at all —
 * better to say "no match" than offer an obviously-wrong option. */
const MIN_CANDIDATE_SCORE = 0.2;
const MAX_CANDIDATES_SHOWN = 3;

export interface RankedSeriesCandidate {
  result: SearchResult;
  score: number;
}

export type SeriesMatchDecision =
  | { decision: 'auto'; match: RankedSeriesCandidate }
  | { decision: 'choose'; candidates: RankedSeriesCandidate[] }
  | { decision: 'no-match' };

export function matchSeries(candidates: SearchResult[], seriesGuess: string): SeriesMatchDecision {
  const ranked = candidates
    .map((result) => ({ result, score: seriesSimilarity(result.title, seriesGuess) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < MIN_CANDIDATE_SCORE) return { decision: 'no-match' };

  const runnerUp = ranked[1];
  const gap = runnerUp ? best.score - runnerUp.score : 1;
  if (best.score >= MIN_CONFIDENT_SCORE && gap >= CONFIDENCE_GAP) {
    return { decision: 'auto', match: best };
  }

  const shown = ranked.filter((c) => c.score >= MIN_CANDIDATE_SCORE).slice(0, MAX_CANDIDATES_SHOWN);
  return { decision: 'choose', candidates: shown };
}

// ── Orchestration ────────────────────────────────────────────────────────────

export type ComicUpcResult =
  | { status: 'not-found' }
  | { status: 'service-error' }
  /** UPCitemdb had a listing, but nothing on ComicVine came close
   * enough to even offer as a choice. */
  | { status: 'no-match'; rawTitle: string }
  | { status: 'auto'; issueNumber: string | null; match: SearchResult }
  | { status: 'choose'; issueNumber: string | null; candidates: RankedSeriesCandidate[] };

/**
 * Full pipeline: UPC -> UPCitemdb listing -> parse -> ComicVine series
 * search -> fuzzy match. Stops short of calling getIssueDetails —
 * that's a separate step (see resolveSeriesSelection) so the dialog
 * can call it either immediately (auto/confident match) or after the
 * user picks from a 'choose' candidate list.
 */
export async function lookupComicByUpc(upc: string): Promise<ComicUpcResult> {
  const listing = await lookupUpcitemdbListing(upc);
  if (listing.status !== 'found') return listing;

  const { seriesGuess, issueNumber } = parseComicListing(listing.title);
  if (!seriesGuess) return { status: 'no-match', rawTitle: listing.title };

  let candidates: SearchResult[];
  try {
    candidates = await searchSeries(seriesGuess);
  } catch {
    return { status: 'service-error' };
  }
  if (candidates.length === 0) return { status: 'no-match', rawTitle: listing.title };

  const decision = matchSeries(candidates, seriesGuess);
  if (decision.decision === 'no-match') return { status: 'no-match', rawTitle: listing.title };
  if (decision.decision === 'auto') {
    return { status: 'auto', issueNumber, match: decision.match.result };
  }
  return { status: 'choose', issueNumber, candidates: decision.candidates };
}

/**
 * Given a chosen series (auto-matched or user-picked from a 'choose'
 * list) and an optional issue number, produces the final fill result.
 * With an issue number, this fetches full ComicVine issue details
 * (credits, cover date, cover image) — the same call the manual
 * "Fetch issue details" button makes — and merges them with the
 * series fields into one combined result. Without one, it returns the
 * series fields alone (Series + Publisher), same as today's typed-
 * search fast path, leaving the manual issue-number step to finish
 * the rest.
 */
export async function resolveSeriesSelection(
  seriesMatch: SearchResult,
  issueNumber: string | null,
): Promise<SearchResult> {
  if (!issueNumber) return seriesMatch;

  const volumeId = seriesMatch.fields['comicVineVolumeId'];
  if (!volumeId) return seriesMatch;

  try {
    const { fields: issueFields } = await getIssueDetails(volumeId, issueNumber);
    if (Object.keys(issueFields).length === 0) return seriesMatch;

    return {
      ...seriesMatch,
      subtitle: [seriesMatch.subtitle, `Issue #${issueNumber}`].filter(Boolean).join(' · '),
      fields: {
        ...seriesMatch.fields,
        ...issueFields,
        issueStart: issueNumber,
        issueEnd: issueNumber,
      },
    };
  } catch {
    // Issue-detail fetch failing shouldn't lose the series match
    // that's already been confirmed — fall back to series-only, same
    // as the "no issue number parsed" case.
    return seriesMatch;
  }
}
