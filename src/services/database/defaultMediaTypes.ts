import type { MediaType } from '@/models';

/**
 * Default media types, per PRD section 4 and UI & UX Specification
 * section 2 (accent colours). Seeded into the `mediaTypes` table the
 * first time the database is opened (see services/database/seed.ts).
 * Existing installs receive any newly-added defaults via a Dexie
 * migration instead (see db.ts, version 8).
 *
 * This is the only place these ten media types are defined — forms,
 * charts and badges all read from the `mediaTypes` table rather than
 * referencing this list directly, so the app continues to work
 * correctly if the user edits or adds media types in Settings
 * (Milestone 7).
 *
 * Only Book, Audiobook, Film, TV and Comic ship `enabled: true` here —
 * a deliberately small default set for a new install's Add Entry
 * screen (see chat). Everyone else (Magazine, Video Games, Podcast,
 * Art, Theatre, Sport, Anime, Manga) ships `enabled: false` and stays
 * one Settings > Manage media types toggle away. Because `seed.ts`
 * only writes this list when the `mediaTypes` table is empty, this
 * only affects brand-new installs — every existing install already
 * has its own rows in that table (all `enabled: true` from prior
 * migrations) and is completely unaffected by this default.
 */
export const defaultMediaTypes: MediaType[] = [
  {
    id: 'book',
    displayName: 'Book',
    icon: 'menu_book',
    colour: '#1976D2',
    enabled: true,
    fields: [
      { key: 'author', label: 'Author', type: 'text', required: false },
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'volume', label: 'Volume', type: 'text', required: false },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['Physical Copy', 'Kindle', 'Libby', 'Kobo', 'Apple Books'],
      },
      // Added for Open Library auto-fill (Settings > Metadata auto-fill).
      // Year-only — see matching comment on releaseYear in
      // entrySchemas.ts's bookMetadataSchema.
      { key: 'releaseYear', label: 'Release Year', type: 'number', required: false },
      // Added for Google Books auto-fill — see chat, Aug 2026. Unlocks
      // the "longest book" Statistics tile. Book only, not Audiobook —
      // "pages" isn't a meaningful unit for an audio format.
      { key: 'pageCount', label: 'Page Count', type: 'number', required: false },
      { key: 'isbn', label: 'ISBN', type: 'text', required: false },
    ],
  },
  {
    id: 'audiobook',
    displayName: 'Audiobook',
    icon: 'headphones',
    colour: '#7B1FA2',
    enabled: true,
    fields: [
      { key: 'author', label: 'Author', type: 'text', required: false },
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'volume', label: 'Volume', type: 'text', required: false },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['Audible', 'Spotify', 'Libby', 'Physical CD'],
      },
      // Added for Google Books auto-fill — see chat, Aug 2026.
      { key: 'isbn', label: 'ISBN', type: 'text', required: false },
    ],
  },
  {
    id: 'film',
    displayName: 'Film',
    icon: 'movie',
    colour: '#D32F2F',
    enabled: true,
    fields: [
      { key: 'director', label: 'Director', type: 'text', required: false },
      { key: 'screenwriter', label: 'Screenwriter', type: 'text', required: false },
      { key: 'cast', label: 'Cast', type: 'text', required: false },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: [
          'Netflix',
          'Disney+',
          'Amazon Prime Video',
          'BBC iPlayer',
          'ITVX',
          'Channel 4 (All 4)',
          'Channel 5 (My5)',
          'Sky/NOW',
          'BritBox',
          'Theatrical',
          'Max',
          'Hulu',
          'Apple TV+',
          'Paramount+',
          'Physical Media',
          'Digital',
        ],
      },
      // Added for TMDB auto-fill (Settings > Metadata auto-fill). Appended
      // after the original fields so Media Details keeps its existing
      // fields on top with these newer ones underneath. `overview` and
      // `posterPath` are deliberately NOT declared here — they get
      // bespoke UI treatment in EntryForm (poster thumbnail near the
      // top, Overview as its own block at the bottom) rather than
      // rendering through the generic field loop, but both are still
      // valid metadata keys per filmMetadataSchema in entrySchemas.ts.
      { key: 'runtime', label: 'Runtime (minutes)', type: 'number', required: false },
      {
        key: 'productionCompany',
        label: 'Production company',
        type: 'text',
        required: false,
      },
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'releaseDate', label: 'Release Date', type: 'date', required: false },
    ],
  },
  {
    id: 'tv',
    displayName: 'TV Season',
    icon: 'tv',
    colour: '#388E3C',
    enabled: true,
    fields: [
      { key: 'seasonNumber', label: 'Season Number', type: 'number', required: false },
      { key: 'episodeStart', label: 'Episode Start', type: 'number', required: false },
      { key: 'episodeEnd', label: 'Episode End', type: 'number', required: false },
      { key: 'creator', label: 'Creator', type: 'text', required: false },
      { key: 'showrunner', label: 'Showrunner', type: 'text', required: false },
      { key: 'cast', label: 'Cast', type: 'text', required: false },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: [
          'Netflix',
          'Disney+',
          'Amazon Prime Video',
          'BBC iPlayer',
          'ITVX',
          'Channel 4 (All 4)',
          'Channel 5 (My5)',
          'Sky/NOW',
          'BritBox',
          'Theatrical',
          'Max',
          'Hulu',
          'Apple TV+',
          'Paramount+',
          'Physical Media',
          'Digital',
        ],
      },
      // Added for TMDB auto-fill — see the matching comment on 'film'
      // above. Note: TMDB has no "collection" concept for TV shows (only
      // films belong to a collection), so `series` is here as a manually
      // editable field for consistency, but auto-fill never populates it
      // for TV entries — only Film gets that from TMDB.
      { key: 'network', label: 'Network', type: 'text', required: false },
      { key: 'runtime', label: 'Runtime (minutes)', type: 'number', required: false },
      { key: 'tvStatus', label: 'Status', type: 'text', required: false },
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'releaseDate', label: 'Release Date', type: 'date', required: false },
    ],
  },
  {
    id: 'comic',
    displayName: 'Comic Issues',
    icon: 'auto_stories',
    colour: '#F57C00',
    enabled: true,
    fields: [
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'issueStart', label: 'Issue Start', type: 'number', required: false },
      { key: 'issueEnd', label: 'Issue End', type: 'number', required: false },
      // Manual only — deliberately NOT part of the ComicVine auto-fill
      // block below (see chat). ComicVine's own "volume" resource is
      // what `series` above maps to; this is the user's own
      // numbering/collection note (e.g. "Vol. 2"). Drives the
      // Library-card title-suffix treatment, same pattern as TV/Anime's
      // seasonNumber.
      { key: 'volume', label: 'Volume', type: 'text', required: false },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: [
          'Physical',
          'Humble Bundle',
          'Marvel Unlimited',
          'Kindle/Comixology',
          'Hoopla',
          'Libby',
          'Digital',
          'Global Comix',
          'Comichaus',
          'Webtoons',
        ],
      },
      // Added for ComicVine auto-fill (Settings > Metadata auto-fill).
      // Appended after the original fields, same convention as the TMDB
      // fields on 'film'/'tv' above. `coverImagePath` is deliberately
      // NOT declared here — it gets bespoke UI in EntryForm (a cover
      // thumbnail, opt-in) rather than rendering through the generic
      // field loop, but it's still a valid metadata key per
      // comicMetadataSchema in entrySchemas.ts.
      { key: 'publisher', label: 'Publisher', type: 'text', required: false },
      { key: 'issueTitle', label: 'Issue title', type: 'text', required: false },
      { key: 'coverDate', label: 'Cover date', type: 'text', required: false },
      { key: 'writer', label: 'Writer', type: 'text', required: false },
      { key: 'penciller', label: 'Penciller', type: 'text', required: false },
      { key: 'inker', label: 'Inker', type: 'text', required: false },
      { key: 'colorist', label: 'Colorist', type: 'text', required: false },
      { key: 'letterer', label: 'Letterer', type: 'text', required: false },
      { key: 'coverArtist', label: 'Cover artist', type: 'text', required: false },
      { key: 'editor', label: 'Editor', type: 'text', required: false },
    ],
  },
  {
    id: 'magazine',
    displayName: 'Magazine Issues',
    icon: 'newspaper',
    colour: '#3949AB',
    enabled: false,
    // Deliberately mirrors 'comic' field-for-field, per David's instruction
    // that Magazine Issues should behave the same as Comic Issues.
    fields: [
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'issueStart', label: 'Issue Start', type: 'number', required: false },
      { key: 'issueEnd', label: 'Issue End', type: 'number', required: false },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['Physical', 'Marvel Unlimited', 'Kindle/Comixology', 'Hoopla', 'Libby'],
      },
    ],
  },
  {
    id: 'game',
    displayName: 'Video Games',
    icon: 'sports_esports',
    colour: '#0097A7',
    enabled: false,
    // Scoped and wireframed with David (see chat, Aug 2026). `source`
    // is deliberately kept distinct from the new `platform` field:
    // `source` is "where you access it" (storefront/physical),
    // `platform` is the specific hardware. ESRB/PEGI rating is
    // explicitly out of scope. `genres` isn't declared here — it's
    // already a universal top-level field on every entry regardless of
    // media type.
    fields: [
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['Steam', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Physical'],
      },
      {
        key: 'platform',
        label: 'Platform',
        type: 'autocomplete',
        required: false,
        options: [
          'PC',
          'PlayStation 5',
          'PlayStation 4',
          'Xbox Series X|S',
          'Xbox One',
          'Nintendo Switch',
          'Nintendo Switch 2',
          'Steam Deck',
          'Mobile',
        ],
      },
      { key: 'developer', label: 'Developer', type: 'text', required: false },
      { key: 'publisher', label: 'Publisher', type: 'text', required: false },
      { key: 'series', label: 'Series / Franchise', type: 'text', required: false },
      {
        key: 'gameMode',
        label: 'Game Mode',
        type: 'autocomplete',
        required: false,
        options: ['Single-player', 'Multiplayer', 'Co-op', 'Online Multiplayer', 'Split-screen'],
      },
      { key: 'releaseYear', label: 'Release Year', type: 'number', required: false },
      { key: 'hoursPlayed', label: 'Hours Played', type: 'number', required: false },
      { key: 'completionPercent', label: 'Completion %', type: 'number', required: false },
      { key: 'achievementsEarned', label: 'Achievements Earned', type: 'number', required: false },
      { key: 'achievementsTotal', label: 'Achievements Total', type: 'number', required: false },
    ],
  },
  {
    id: 'podcast',
    displayName: 'Podcasts',
    icon: 'mic',
    colour: '#5D4037',
    enabled: false,
    fields: [
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: [
          'Spotify',
          'Apple Podcasts',
          'YouTube',
          'Overcast',
          'Podcast Addict',
          'PodBean',
        ],
      },
      // Added for Podcast RSS auto-fill (see chat) — itunes:season,
      // itunes:episode and itunes:duration respectively. Order matches
      // the row layout in EntryForm (Season, Episode, Duration).
      // `overview` (Show Notes, from itunes:summary/<description>) is
      // deliberately NOT declared here — same pattern as Film/TV's
      // Overview, it gets a multiline block in EntryForm instead of
      // the generic single-line field loop.
      { key: 'seasonNumber', label: 'Season Number', type: 'number', required: false },
      { key: 'episodeNumber', label: 'Episode Number', type: 'number', required: false },
      { key: 'duration', label: 'Duration (minutes)', type: 'number', required: false },
    ],
  },
  {
    id: 'art',
    displayName: 'Art',
    icon: 'palette',
    colour: '#F9A825',
    enabled: false,
    fields: [
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['In-Person', 'Museum', 'Online', 'Print'],
      },
    ],
  },
  {
    id: 'theatre',
    displayName: 'Theatre',
    icon: 'theater_comedy',
    colour: '#C2185B',
    enabled: false,
    fields: [
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['In-Person', 'Broadcast/Streamed'],
      },
    ],
  },
  {
    id: 'sport',
    displayName: 'Sports',
    icon: 'sports_soccer',
    colour: '#2E7D32',
    enabled: false,
    // Single sporting events (a match/game), not ongoing season/league
    // tracking. Genre is reused as "Sport" (e.g. Football, Tennis) so
    // it shares the app's existing Genre filter/suggestion mechanism
    // rather than needing a bespoke one. `teamA`/`teamB`/`scoreA`/
    // `scoreB`/`supporting`/`outcome` together drive the entry title
    // ("{teamA} vs {teamB}") and the Library card's score display.
    fields: [
      {
        key: 'sport',
        label: 'Sport',
        type: 'autocomplete',
        required: false,
        options: [
          'Football',
          'Basketball',
          'Tennis',
          'Rugby',
          'Cricket',
          'American Football',
          'Baseball',
          'Ice Hockey',
          'Athletics',
          'Motorsport',
        ],
      },
      { key: 'teamA', label: 'Team', type: 'text', required: false },
      { key: 'scoreA', label: 'Score', type: 'number', required: false },
      { key: 'teamB', label: 'Team', type: 'text', required: false },
      { key: 'scoreB', label: 'Score', type: 'number', required: false },
      { key: 'supporting', label: 'Supporting', type: 'text', required: false },
      {
        key: 'outcome',
        label: 'Outcome',
        type: 'autocomplete',
        required: false,
        options: ['Win', 'Draw', 'Loss'],
      },
      {
        key: 'watchedVia',
        label: 'Watched via',
        type: 'autocomplete',
        required: false,
        options: [
          'Attended in-person',
          'Live (TV/broadcast)',
          'Live (stream)',
          'Replay / highlights',
        ],
      },
      { key: 'venue', label: 'Venue', type: 'text', required: false },
    ],
  },
  {
    id: 'anime',
    displayName: 'Anime',
    icon: 'live_tv',
    colour: '#5C6BC0',
    enabled: false,
    // Metadata for this type comes from MyAnimeList directly (once the
    // MAL import ships), not TMDB — `malId`/`coverImagePath` mirror the
    // `posterPath`/`coverImagePath` convention used for Film/TV/Comic
    // auto-fill (bespoke UI in EntryForm rather than the generic field
    // loop). Now backed by `animeMetadataSchema` in entrySchemas.ts
    // (see chat, added alongside `seasonNumber` below) — any new field
    // added here must be added there too.
    fields: [
      { key: 'studio', label: 'Studio', type: 'text', required: false },
      {
        key: 'format',
        label: 'Format',
        type: 'autocomplete',
        required: false,
        options: ['TV', 'Movie', 'OVA', 'Special'],
      },
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: [
          'Crunchyroll',
          'Netflix',
          'HIDIVE',
          'Funimation',
          'Disney+',
          'BBC iPlayer',
          'ITVX',
          'Channel 4 (All 4)',
          'Channel 5 (My5)',
          'Sky/NOW',
          'BritBox',
          'Physical Media',
          'Digital',
        ],
      },
      {
        key: 'episodesWatched',
        label: 'Episodes watched',
        type: 'number',
        required: false,
      },
      { key: 'totalEpisodes', label: 'Total episodes', type: 'number', required: false },
      // Manual only — no source auto-fills this (same as TV's
      // seasonNumber). Drives the Library-card title-suffix treatment
      // (e.g. "Attack on Titan — S4"), same pattern as TV.
      { key: 'seasonNumber', label: 'Season Number', type: 'number', required: false },
      // Added for "Find Next in Series" (see chat, Aug 2026) — Anime
      // previously had no series-grouping field at all (unlike every
      // other type with a `series` role in entryConversion.ts's
      // FIELD_ROLES). Paired with the existing `seasonNumber` above as
      // this type's Number for that feature.
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'malId', label: 'MyAnimeList ID', type: 'text', required: false },
      { key: 'coverImagePath', label: 'Cover image URL', type: 'text', required: false },
    ],
  },
  {
    id: 'manga',
    displayName: 'Manga',
    icon: 'remove_red_eye',
    colour: '#8E24AA',
    enabled: false,
    // Now backed by a dedicated `mangaMetadataSchema` in
    // entrySchemas.ts (see chat, Aug 2026 — added alongside
    // `series`/`volumeNumber` below, previously fell through to the
    // permissive genericMetadataSchema). Any new field added here must
    // be added there too, same discipline as animeMetadataSchema.
    fields: [
      { key: 'author', label: 'Author', type: 'text', required: false },
      // Added for "Find Next in Series" (see chat, Aug 2026) — Manga
      // previously had no series-grouping field at all, and its
      // existing numeric fields (chaptersRead/volumesRead) track
      // reading *progress*, not "which volume this entry represents"
      // — so `volumeNumber` is a distinct new field rather than reusing
      // one of those.
      { key: 'series', label: 'Series', type: 'text', required: false },
      { key: 'volumeNumber', label: 'Volume Number', type: 'number', required: false },
      { key: 'chaptersRead', label: 'Chapters read', type: 'number', required: false },
      { key: 'totalChapters', label: 'Total chapters', type: 'number', required: false },
      { key: 'volumesRead', label: 'Volumes read', type: 'number', required: false },
      { key: 'totalVolumes', label: 'Total volumes', type: 'number', required: false },
      { key: 'malId', label: 'MyAnimeList ID', type: 'text', required: false },
      { key: 'coverImagePath', label: 'Cover image URL', type: 'text', required: false },
      // Added so Manga entries can participate in Source-based
      // Statistics (Sources, Subscription Value) — see chat. Mirrors
      // Comic's options, plus a couple of manga-specific services.
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: [
          'Physical',
          'Marvel Unlimited',
          'Kindle/Comixology',
          'Hoopla',
          'Libby',
          'Digital',
          'Shonen Jump',
          'Webtoons',
        ],
      },
    ],
  },
];
