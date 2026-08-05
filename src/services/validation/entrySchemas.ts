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
  // Open Library auto-fill (Settings > Metadata auto-fill (Open
  // Library)) — year-only, since that's all Open Library's search
  // index reliably gives (`first_publish_year`), unlike TMDB's full
  // release_date for Film/TV.
  //
  // BUG FIX (see chat): this was `z.string()`, but defaultMediaTypes.ts
  // declares this field `type: 'number'` — which makes EntryForm's
  // Controller render it as a numeric input AND makes
  // applyMetadataFill (EntryForm.tsx) convert the auto-filled value to
  // a real number via `Number(value)` before writing it here. Every
  // book whose Release Year got auto-filled therefore saved a number
  // against a schema expecting a string, failing validation with
  // Zod's "Invalid input: expected string, received number" and
  // silently blocking the save. `z.coerce.number()` both matches the
  // field's declared type and tolerates a stray string (e.g. from
  // backfillService.ts's applyBookMatch, which writes Open Library's
  // raw string as-is rather than converting it — also worth fixing at
  // the source, done below, but this keeps the schema robust either
  // way).
  releaseYear: z.coerce.number().optional(),
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
  runtime: z.coerce.number().min(0).optional(),
  productionCompany: z.string().optional(),
  series: z.string().optional(),
  overview: z.string().max(2000).optional(),
  posterPath: z.string().optional(),
  // TMDB auto-fill — full ISO `yyyy-mm-dd`, unlike Open Library's
  // year-only `releaseYear` on Books (TMDB's release_date is a full
  // date). Rendered via EntryDatePicker like Started/Completed dates.
  releaseDate: z.string().optional(),
  // Shared-link support: TMDB id, persisted whenever a film is filled
  // via search or a shared link, so the entry can later be re-shared
  // as a smart link too. Hidden field — not in defaultMediaTypes.ts's
  // `fields[]`, same pattern as posterPath above.
  tmdbId: z.string().optional(),
  // Cover image search / manual URL paste (EntryForm's "Find cover
  // image" — see chat). Only ever set by the user, never by TMDB
  // auto-fill, which always writes `posterPath` instead; kept as a
  // separate key rather than overloading `posterPath` since it holds
  // a complete hosted URL, not a TMDB path fragment. getEntryImageUrl
  // (entryImage.ts) checks `posterPath` first and only falls back to
  // this, so a manually-picked image never overrides a TMDB one.
  coverImagePath: z.string().optional(),
});

const tvMetadataSchema = z.object({
  seasonNumber: z.coerce.number().min(1, 'Season number must be at least 1').optional(),
  episodeStart: z.coerce.number().min(1, 'Episode must be at least 1').optional(),
  episodeEnd: z.coerce.number().min(1, 'Episode must be at least 1').optional(),
  creator: z.string().optional(),
  showrunner: z.string().optional(),
  cast: z.string().optional(),
  source: z.string().optional(),
  // TMDB auto-fill fields — see matching comment on filmMetadataSchema.
  network: z.string().optional(),
  runtime: z.coerce.number().min(0).optional(),
  tvStatus: z.string().optional(),
  series: z.string().optional(),
  overview: z.string().max(2000).optional(),
  posterPath: z.string().optional(),
  // TMDB auto-fill — see matching comment on filmMetadataSchema.
  // Sourced from `first_air_date` rather than `release_date` for TV.
  releaseDate: z.string().optional(),
  // Shared-link support — see matching comment on filmMetadataSchema.
  tmdbId: z.string().optional(),
  // Cover image search / manual URL paste — see matching comment on
  // filmMetadataSchema.
  coverImagePath: z.string().optional(),
});

const comicMetadataSchema = z
  .object({
    series: z.string().optional(),
    issueStart: z.coerce.number().min(1, 'Issue start must be at least 1').optional(),
    issueEnd: z.coerce.number().optional(),
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
  episodesWatched: z.coerce.number().min(0).optional(),
  totalEpisodes: z.coerce.number().min(0).optional(),
  seasonNumber: z.coerce.number().min(1, 'Season number must be at least 1').optional(),
  malId: z.string().optional(),
  coverImagePath: z.string().optional(),
});

/**
 * Podcasts previously had no dedicated schema — its metadata fell
 * through to `genericMetadataSchema` (same situation Anime was in
 * before it got one; see matching comment on animeMetadataSchema).
 * Adding Season/Episode/Duration (see chat) meant it needed real
 * number coercion, since defaultMediaTypes.ts declares these
 * `type: 'number'` and EntryForm always writes numeric metadata as a
 * real number — a plain z.string() here would silently fail to save,
 * same bug already hit and fixed on Book's releaseYear. `overview`
 * (Show Notes) and the subscription/dedup fields aren't in
 * defaultMediaTypes.ts's `fields[]` (overview gets a multiline block
 * in EntryForm, the other two are RSS-sync bookkeeping never shown in
 * the form) but must still be listed here or they'd be silently
 * stripped on save — same pattern as posterPath on filmMetadataSchema.
 */
const podcastMetadataSchema = z.object({
  source: z.string().optional(),
  seasonNumber: z.coerce.number().min(1, 'Season number must be at least 1').optional(),
  episodeNumber: z.coerce.number().min(1, 'Episode number must be at least 1').optional(),
  duration: z.coerce.number().min(0).optional(),
  overview: z.string().max(2000).optional(),
  coverImagePath: z.string().optional(),
  podcastSubscriptionId: z.string().optional(),
  episodeGuid: z.string().optional(),
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
  podcast: podcastMetadataSchema,
};

/** Returns the appropriate metadata schema for a given media type id. */
export function getMetadataSchema(mediaTypeId: string): z.ZodType {
  return metadataSchemasByMediaType[mediaTypeId] ?? genericMetadataSchema;
}
