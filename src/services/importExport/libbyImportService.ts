import { db } from '@/services/database/db';
import { createEntry, updateEntry } from '@/services/database/entryService';
import type { EntryMetadata, EntryStatus } from '@/models';
import { importedFromTag } from '@/utils/importedFromTag';
import { toTitleCase } from '@/utils/toTitleCase';

export interface LibbyRow {
  itemKey: string;
  title: string;
  mediaType: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  titleId?: string;
  titleUrl?: string;
  coverUrl?: string;
  borrowDates: string[];
}

export type LibbyRowStatus = 'ready' | 'duplicate' | 'new_loans' | 'skipped';

export interface LibbyRowState {
  row: LibbyRow;
  status: LibbyRowStatus;
  entryStatus: EntryStatus;
  completedDate?: string;
  included: boolean;
  existingEntryId?: string;
  newLoanDates: string[];
}

interface RawTimelineEntry {
  title?: { text?: string; url?: string; titleId?: string } | string;
  author?: string;
  publisher?: string;
  isbn?: string;
  timestamp?: number;
  activity?: string;
  cover?: { format?: string; url?: string };
}

function normalizedTitle(title: string): string {
  return title.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function itemKeyFor(isbn: string | undefined, title: string): string {
  return isbn
    ? `isbn:${isbn.replace(/[^\dX]/gi, '').toUpperCase()}`
    : `title:${normalizedTitle(title)}`;
}

function guessMediaType(entry: RawTimelineEntry, title: string): string {
  const format = entry.cover?.format?.trim().toLowerCase();
  if (format === 'audiobook') return 'audiobook';
  if (format === 'comic' || format === 'magazine') return format;

  const publisher = entry.publisher?.trim().toLowerCase() ?? '';
  if (/\bcomics?\b/.test(publisher) || publisher === 'marvel') return 'comic';
  if (
    /\b(volume|vol\.)\s*\d+\b/i.test(title) &&
    /\b(image|dark horse|dc|marvel)\b/i.test(publisher)
  ) {
    return 'comic';
  }
  return 'book';
}

function borrowDate(timestamp: number): string | undefined {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Parses Libby's version 1 timeline export and groups repeated loans by ISBN. */
export function parseLibbyTimeline(jsonText: string): LibbyRow[] {
  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error('That file is not valid JSON. Choose a Libby timeline export.');
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('version' in payload) ||
    !('timeline' in payload) ||
    (payload as { version: unknown }).version !== 1 ||
    !Array.isArray((payload as { timeline: unknown }).timeline)
  ) {
    throw new Error(
      'This Libby export format is not supported. Choose a version 1 timeline export.',
    );
  }

  const grouped = new Map<string, LibbyRow>();
  for (const raw of (payload as { timeline: RawTimelineEntry[] }).timeline) {
    if (!raw || raw.activity?.trim().toLowerCase() !== 'borrowed') continue;
    const title =
      typeof raw.title === 'string' ? raw.title.trim() : raw.title?.text?.trim();
    if (!title) continue;

    const isbn = raw.isbn?.trim() || undefined;
    const key = itemKeyFor(isbn, title);
    const date =
      typeof raw.timestamp === 'number' ? borrowDate(raw.timestamp) : undefined;
    const existing = grouped.get(key);
    if (existing) {
      if (date && !existing.borrowDates.includes(date)) existing.borrowDates.push(date);
      continue;
    }

    grouped.set(key, {
      itemKey: key,
      title,
      mediaType: guessMediaType(raw, title),
      author: raw.author?.trim() || undefined,
      publisher: raw.publisher?.trim() || undefined,
      isbn,
      titleId: typeof raw.title === 'object' ? raw.title.titleId : undefined,
      titleUrl: typeof raw.title === 'object' ? raw.title.url : undefined,
      coverUrl: raw.cover?.url,
      borrowDates: date ? [date] : [],
    });
  }

  return Array.from(grouped.values())
    .map((row) => ({ ...row, borrowDates: row.borrowDates.sort() }))
    .sort((a, b) => (b.borrowDates[0] ?? '').localeCompare(a.borrowDates[0] ?? ''));
}

function existingItemKey(metadata: EntryMetadata, title: string): string | undefined {
  if (typeof metadata.libbyItemKey === 'string') return metadata.libbyItemKey;
  if (metadata.source === 'Libby' && typeof metadata.isbn === 'string' && metadata.isbn) {
    return itemKeyFor(metadata.isbn, title);
  }
  return undefined;
}

/** Classifies both prior imports and same-file repeats before showing review. */
export async function classifyLibbyRows(rows: LibbyRow[]): Promise<LibbyRowState[]> {
  const existing = await db.mediaEntries.toArray();
  const byLibbyKey = new Map<string, (typeof existing)[number]>();
  const byTitle = new Map<string, (typeof existing)[number]>();

  for (const entry of existing) {
    const key = existingItemKey(entry.metadata ?? {}, entry.title);
    if (key && !byLibbyKey.has(key)) byLibbyKey.set(key, entry);
    const titleKey = `${entry.mediaType}|${normalizedTitle(entry.title)}`;
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, entry);
  }

  return rows.map((row): LibbyRowState => {
    const matched =
      byLibbyKey.get(row.itemKey) ??
      byTitle.get(`${row.mediaType}|${normalizedTitle(row.title)}`);
    if (!matched) {
      return {
        row,
        status: 'ready',
        entryStatus: 'in_progress',
        included: true,
        newLoanDates: row.borrowDates,
      };
    }

    const priorDates =
      typeof matched.metadata.libbyLoanDates === 'string'
        ? matched.metadata.libbyLoanDates.split(',').filter(Boolean)
        : [];
    const newLoanDates = row.borrowDates.filter((date) => !priorDates.includes(date));
    const isLibbyEntry = existingItemKey(matched.metadata, matched.title) === row.itemKey;

    if (isLibbyEntry && newLoanDates.length > 0) {
      return {
        row,
        status: 'new_loans',
        entryStatus: matched.status,
        completedDate: matched.completedDate,
        included: true,
        existingEntryId: matched.id,
        newLoanDates,
      };
    }

    return {
      row,
      status: 'duplicate',
      entryStatus: matched.status,
      completedDate: matched.completedDate,
      included: false,
      existingEntryId: matched.id,
      newLoanDates: [],
    };
  });
}

function buildMetadata(row: LibbyRow): EntryMetadata {
  const metadata: EntryMetadata = {
    source: 'Libby',
    libbyItemKey: row.itemKey,
    libbyLoanDates: row.borrowDates.join(','),
    libbyLoanEventCount: row.borrowDates.length,
  };
  if (row.author) {
    if (row.mediaType === 'comic') metadata.writer = toTitleCase(row.author);
    else metadata.author = toTitleCase(row.author);
  }
  if (row.publisher) metadata.publisher = row.publisher;
  if (row.isbn) metadata.isbn = row.isbn;
  if (row.titleId) metadata.libbyTitleId = row.titleId;
  if (row.titleUrl) metadata.libbyTitleUrl = row.titleUrl;
  if (row.coverUrl) metadata.coverImagePath = row.coverUrl;
  return metadata;
}

export async function applyLibbyRow(
  state: LibbyRowState,
): Promise<'imported' | 'updated' | 'skipped'> {
  if (!state.included || state.status === 'duplicate' || state.status === 'skipped')
    return 'skipped';

  if (state.status === 'new_loans' && state.existingEntryId) {
    const existing = await db.mediaEntries.get(state.existingEntryId);
    if (!existing) return 'skipped';
    const previous =
      typeof existing.metadata.libbyLoanDates === 'string'
        ? existing.metadata.libbyLoanDates.split(',').filter(Boolean)
        : [];
    const allDates = Array.from(new Set([...previous, ...state.newLoanDates])).sort();
    await updateEntry(existing.id, {
      metadata: {
        ...existing.metadata,
        libbyItemKey: state.row.itemKey,
        libbyLoanDates: allDates.join(','),
        libbyLoanEventCount: allDates.length,
      },
    });
    return 'updated';
  }

  if (state.entryStatus === 'completed' && !state.completedDate) return 'skipped';
  const startedDate = state.row.borrowDates[0];
  await createEntry({
    title: toTitleCase(state.row.title),
    mediaType: state.row.mediaType,
    status: state.entryStatus,
    startedDate: state.entryStatus === 'wishlist' ? undefined : startedDate,
    completedDate: state.entryStatus === 'completed' ? state.completedDate : undefined,
    repeatConsumption: false,
    tags: [importedFromTag('Libby')],
    genres: [],
    watchedWith: [],
    recommendedBy: [],
    metadata: buildMetadata(state.row),
  });
  return 'imported';
}
