/**
 * "People" stats (see chat, Aug 2026) — most-credited actors,
 * directors, writers, etc. across completed entries. Each role maps
 * to one or more (mediaType, metadata field) pairs; fields hold
 * comma-separated names (TMDB/ComicVine free-text convention), split
 * and counted individually.
 *
 * Comic's five visual-art crew roles (Penciller, Inker, Colorist,
 * Letterer, Cover Artist) are deliberately combined into one "Artist"
 * category rather than kept separate — Writer and Editor stay on
 * their own, since those aren't art roles. Director is Film-only —
 * TV has no director field today (Creator/Showrunner instead).
 */
export type PersonRole =
  | 'actor'
  | 'director'
  | 'screenwriter'
  | 'creator'
  | 'showrunner'
  | 'author'
  | 'writer'
  | 'artist'
  | 'editor';

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  actor: 'Actors',
  director: 'Directors',
  screenwriter: 'Screenwriters',
  creator: 'Creators',
  showrunner: 'Showrunners',
  author: 'Authors',
  writer: 'Writers',
  artist: 'Artists',
  editor: 'Editors',
};

export const PERSON_ROLE_FIELDS: Record<PersonRole, { mediaTypeId: string; fieldKey: string }[]> = {
  actor: [
    { mediaTypeId: 'film', fieldKey: 'cast' },
    { mediaTypeId: 'tv', fieldKey: 'cast' },
  ],
  director: [{ mediaTypeId: 'film', fieldKey: 'director' }],
  screenwriter: [{ mediaTypeId: 'film', fieldKey: 'screenwriter' }],
  creator: [{ mediaTypeId: 'tv', fieldKey: 'creator' }],
  showrunner: [{ mediaTypeId: 'tv', fieldKey: 'showrunner' }],
  author: [
    { mediaTypeId: 'book', fieldKey: 'author' },
    { mediaTypeId: 'audiobook', fieldKey: 'author' },
  ],
  writer: [{ mediaTypeId: 'comic', fieldKey: 'writer' }],
  artist: [
    { mediaTypeId: 'comic', fieldKey: 'penciller' },
    { mediaTypeId: 'comic', fieldKey: 'inker' },
    { mediaTypeId: 'comic', fieldKey: 'colorist' },
    { mediaTypeId: 'comic', fieldKey: 'letterer' },
    { mediaTypeId: 'comic', fieldKey: 'coverArtist' },
  ],
  editor: [{ mediaTypeId: 'comic', fieldKey: 'editor' }],
};

/** Splits a comma-separated metadata value (e.g. Cast, Screenwriter)
 * into individual trimmed names, dropping empties. */
export function splitPeople(value: string): string[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}
