/**
 * Button label for "log a rewatch/reread/replay" on Edit Entry —
 * duplicates an entry's core metadata into a fresh entry (see chat:
 * "Log a Rewatch" feature). Deliberately conservative: only media
 * types with a natural, unambiguous verb get one; everything else
 * (Art, Theatre, Sport, Podcast, custom types, ...) falls back to the
 * generic "Log Again" rather than guessing at an awkward verb.
 */
const RELOG_LABELS: Record<string, string> = {
  film: 'Log a Rewatch',
  tv: 'Log a Rewatch',
  anime: 'Log a Rewatch',
  book: 'Log a Reread',
  comic: 'Log a Reread',
  manga: 'Log a Reread',
  magazine: 'Log a Reread',
  audiobook: 'Log a Relisten',
  podcast: 'Log a Relisten',
  game: 'Log a Replay',
};

export function relogButtonLabel(mediaTypeId: string): string {
  return RELOG_LABELS[mediaTypeId] ?? 'Log Again';
}
