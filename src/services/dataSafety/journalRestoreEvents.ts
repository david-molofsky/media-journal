export const JOURNAL_REPLACED_EVENT = 'media-journal:replaced';

export function notifyJournalReplaced(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(JOURNAL_REPLACED_EVENT));
}
