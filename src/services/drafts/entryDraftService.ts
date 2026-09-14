import type { NewMediaEntryInput } from '@/models';

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ADD_DRAFT_KEY = 'mediaJournalEntryDraft:add';
const EDIT_DRAFT_PREFIX = 'mediaJournalEntryDraft:edit:';

export interface StoredEntryDraft {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  values: NewMediaEntryInput;
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readDraft(key: string): StoredEntryDraft | null {
  if (!storageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredEntryDraft>;
    const savedAt = typeof parsed.savedAt === 'string' ? Date.parse(parsed.savedAt) : NaN;
    const values = parsed.values;

    if (
      parsed.version !== DRAFT_VERSION ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > DRAFT_MAX_AGE_MS ||
      !values ||
      typeof values !== 'object' ||
      typeof values.mediaType !== 'string'
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed as StoredEntryDraft;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeDraft(key: string, values: NewMediaEntryInput): void {
  if (!storageAvailable()) return;

  const draft: StoredEntryDraft = {
    version: DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    values,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Draft protection is best-effort. A full or unavailable storage
    // area must never prevent the user from saving the actual entry.
  }
}

function clearDraft(key: string): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(key);
}

function editDraftKey(entryId: string): string {
  return `${EDIT_DRAFT_PREFIX}${encodeURIComponent(entryId)}`;
}

export function loadAddEntryDraft(): StoredEntryDraft | null {
  return readDraft(ADD_DRAFT_KEY);
}

export function saveAddEntryDraft(values: NewMediaEntryInput): void {
  writeDraft(ADD_DRAFT_KEY, values);
}

export function clearAddEntryDraft(): void {
  clearDraft(ADD_DRAFT_KEY);
}

export function loadEditEntryDraft(entryId: string): StoredEntryDraft | null {
  return readDraft(editDraftKey(entryId));
}

export function saveEditEntryDraft(
  entryId: string,
  values: NewMediaEntryInput,
): void {
  writeDraft(editDraftKey(entryId), values);
}

export function clearEditEntryDraft(entryId: string): void {
  clearDraft(editDraftKey(entryId));
}
