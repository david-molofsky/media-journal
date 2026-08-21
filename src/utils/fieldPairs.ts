/**
 * Metadata field keys shown side-by-side on one row instead of each
 * getting its own full-width row — see chat, Aug 2026 (Entry page
 * layout cleanup). Comic/Magazine's Issue Start/End was the original
 * ask; David picked TV, Video Games and Anime/Manga too from the
 * options presented. Order within each pair is left-to-right.
 * Deliberately NOT applied to Sport's teamA/scoreA + teamB/scoreB or
 * Podcast's seasonNumber/episodeNumber — those weren't part of what
 * David selected, and Sport's fields don't map onto a natural "range"
 * or "X of Y" pairing the way these do anyway.
 *
 * Shared between EntryForm (editable rows) and EntryDetailPage
 * (read-only rows, added Aug 2026) so the pairing stays in sync
 * between the two rather than drifting if only defined once and
 * copy-pasted.
 */
export const FIELD_PAIRS: Record<string, [string, string][]> = {
  comic: [['issueStart', 'issueEnd']],
  magazine: [['issueStart', 'issueEnd']],
  tv: [['episodeStart', 'episodeEnd']],
  game: [['achievementsEarned', 'achievementsTotal']],
  anime: [['episodesWatched', 'totalEpisodes']],
  manga: [
    ['chaptersRead', 'totalChapters'],
    ['volumesRead', 'totalVolumes'],
  ],
};
