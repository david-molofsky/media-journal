import { z } from 'zod';
import { isCompletedBeforeStarted } from '@/utils/dateUtils';

/**
 * Common entry validation rules, per Database Schema & Data Model,
 * section 7 (Validation Rules).
 */
export const mediaEntrySchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(250, 'Title is too long'),
    mediaType: z.string().min(1, 'Media type is required'),
    status: z.enum(['completed', 'in_progress', 'wishlist']).default('completed'),
    startedDate: z.string().optional(),
    completedDate: z.string().optional(),
    rating: z
      .number()
      .min(0)
      .max(10)
      .refine((value) => Number.isInteger(value * 2), {
        message: 'Rating must be in 0.5 increments',
      })
      .optional(),
    notes: z.string().max(5000).optional(),
    repeatConsumption: z.boolean(),
    tags: z.array(z.string()),
    genres: z.array(z.string()),
    metadata: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.undefined()]),
    ),
  })
  .superRefine((data, ctx) => {
    // completedDate is required only for completed entries.
    if (data.status === 'completed' && !data.completedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Completed date is required',
        path: ['completedDate'],
      });
    }
    if (isCompletedBeforeStarted(data.startedDate, data.completedDate ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Completed date cannot precede started date',
        path: ['completedDate'],
      });
    }
  });

export type ValidatedMediaEntry = z.infer<typeof mediaEntrySchema>;

/**
 * Per-media-type metadata validation. Known media types from the PRD
 * (Books/Audiobooks, Films, TV, Comics) have explicit rules taken from
 * Database Schema & Data Model, section 7. Any other media type id
 * (e.g. one a user adds in Settings, Milestone 7) falls back to a
 * permissive schema — metadata fields for custom types are rendered
 * dynamically from `MediaType.fields` but are not type-checked beyond
 * "string, number or boolean", which keeps the system genuinely
 * configuration-driven rather than requiring a code change per type.
 */
const bookMetadataSchema = z.object({
  author: z.string().optional(),
  series: z.string().optional(),
  volume: z.string().optional(),
  source: z.string().optional(),
  // Shared-link support: Open Library work key, persisted whenever a
  // book/audiobook is filled via search or a shared link — see
  // matching comment on filmMetadataSchema's tmdbId.
  openLibraryKey: z.string().optional(),
  // Open Library auto-fill (Settings > Metadata auto-fill (Open
  // Library)). Not in defaultMediaTypes.ts's `fields[]` — gets bespoke
  // UI in EntryForm (a cover thumbnail, opt-in), same pattern as
  // Film/TV's posterPath and Comic's coverImagePath. Already a
  // complete, hosted Open Library covers.openlibrary.org URL, used
  // as-is — not a path fragment like TMDB's posterPath.
  coverImagePath: z.string().optional(),
});

const filmMetadataSchema = z.object({
  director: z.string().optional(),
  screenwriter: z.string().optional(),
  cast: z.string().optional(),
  source: z.string().optional(),
  // TMDB auto-fill fields (Settings > Metadata auto-fill). `overview` and
  // `posterPath` aren't in defaultMediaTypes.ts's `fields[]` (they get
  // bespoke UI in EntryForm), but must still be listed here — per-type
  // schemas silently strip any metadata key they don't know about.
  runtime: z.number().min(0).optional(),
  productionCompany: z.string().optional(),
  series: z.string().optional(),
  overview: z.string().max(2000).optional(),
  posterPath: z.string().optional(),
  // Shared-link support: TMDB id, persisted whenever a film is filled
  // via search or a shared link, so the entry can later be re-shared
  // as a smart link too. Hidden field — not in defaultMediaTypes.ts's
  // `fields[]`, same pattern as posterPath above.
  tmdbId: z.string().optional(),
});

const tvMetadataSchema = z.object({
  seasonNumber: z.number().min(1, 'Season number must be at least 1').optional(),
  episodeStart: z.number().min(1, 'Episode must be at least 1').optional(),
  episodeEnd: z.number().min(1, 'Episode must be at least 1').optional(),
  creator: z.string().optional(),
  showrunner: z.string().optional(),
  cast: z.string().optional(),
  source: z.string().optional(),
  // TMDB auto-fill fields — see matching comment on filmMetadataSchema.
  network: z.string().optional(),
  runtime: z.number().min(0).optional(),
  tvStatus: z.string().optional(),
  series: z.string().optional(),
  overview: z.string().max(2000).optional(),
  posterPath: z.string().optional(),
  // Shared-link support — see matching comment on filmMetadataSchema.
  tmdbId: z.string().optional(),
});

const comicMetadataSchema = z
  .object({
    series: z.string().optional(),
    issueStart: z.number().min(1, 'Issue start must be at least 1').optional(),
    issueEnd: z.number().optional(),
    source: z.string().optional(),
    // Free-text, manual-only field — deliberately not part of the
    // ComicVine auto-fill mapping (see chat). ComicVine's own "volume"
    // resource is what we call `series` above; this `volume` is the
    // user's own numbering/collection note (e.g. "Vol. 2").
    volume: z.string().optional(),
    // ComicVine auto-fill fields (Settings > Metadata auto-fill).
    // `coverImagePath` isn't in defaultMediaTypes.ts's `fields[]` (it
    // gets bespoke UI in EntryForm, same pattern as Film/TV's
    // posterPath), but must still be listed here — per-type schemas
    // silently strip any metadata key they don't know about.
    publisher: z.string().optional(),
    issueTitle: z.string().optional(),
    coverDate: z.string().optional(),
    writer: z.string().optional(),
    penciller: z.string().optional(),
    inker: z.string().optional(),
    colorist: z.string().optional(),
    letterer: z.string().optional(),
    coverArtist: z.string().optional(),
    editor: z.string().optional(),
    coverImagePath: z.string().optional(),
  })
  .refine(
    (data) =>
      data.issueStart === undefined ||
      data.issueEnd === undefined ||
      data.issueEnd >= data.issueStart,
    {
      message: 'Issue end must be greater than or equal to issue start',
      path: ['issueEnd'],
    },
  );

/**
 * Anime previously had no dedicated schema — its metadata fell through
 * to `genericMetadataSchema` (see chat, comment on defaultMediaTypes.ts's
 * anime entry). Adding `seasonNumber` for the Library-card title-suffix
 * treatment (same pattern as TV) meant it needed real validation, so
 * this now mirrors every field MAL import + EntryForm currently write:
 * studio/format/source/episodesWatched/totalEpisodes/malId/
 * coverImagePath. IMPORTANT: any future anime metadata field must be
 * added here too, or it will be silently stripped on save — this is
 * no longer a config-only media type.
 */
const animeMetadataSchema = z.object({
  studio: z.string().optional(),
  format: z.string().optional(),
  source: z.string().optional(),
  episodesWatched: z.number().min(0).optional(),
  totalEpisodes: z.number().min(0).optional(),
  seasonNumber: z.number().min(1, 'Season number must be at least 1').optional(),
  malId: z.string().optional(),
  coverImagePath: z.string().optional(),
});

const genericMetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.undefined()]),
);

const metadataSchemasByMediaType: Record<string, z.ZodType> = {
  book: bookMetadataSchema,
  audiobook: bookMetadataSchema,
  film: filmMetadataSchema,
  tv: tvMetadataSchema,
  comic: comicMetadataSchema,
  anime: animeMetadataSchema,
};

/** Returns the appropriate metadata schema for a given media type id. */
export function getMetadataSchema(mediaTypeId: string): z.ZodType {
  return metadataSchemasByMediaType[mediaTypeId] ?? genericMetadataSchema;
}
