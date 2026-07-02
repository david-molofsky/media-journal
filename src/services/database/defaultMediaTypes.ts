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
        options: ['Netflix', 'Disney+', 'Max', 'Hulu', 'Prime Video', 'Apple TV+', 'Theatrical', 'Physical Media'],
      },
    ],
  },
  {
    id: 'tv',
    displayName: 'Television Season',
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
        options: ['Netflix', 'Disney+', 'Max', 'Hulu', 'Prime Video', 'Apple TV+', 'Theatrical', 'Physical Media'],
      },
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
    id: 'magazine',
    displayName: 'Magazine Issues',
    icon: 'newspaper',
    colour: '#3949AB',
    enabled: true,
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
    enabled: true,
    fields: [
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['Steam', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Physical'],
      },
    ],
  },
  {
    id: 'podcast',
    displayName: 'Podcasts',
    icon: 'mic',
    colour: '#5D4037',
    enabled: true,
    fields: [
      {
        key: 'source',
        label: 'Source',
        type: 'autocomplete',
        required: false,
        options: ['Spotify', 'Apple Podcasts', 'YouTube', 'Overcast'],
      },
    ],
  },
  {
    id: 'art',
    displayName: 'Art',
    icon: 'palette',
    colour: '#C2185B',
    enabled: true,
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
    colour: '#F9A825',
    enabled: true,
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
];
