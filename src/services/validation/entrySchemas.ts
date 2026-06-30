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
    startedDate: z.string().optional(),
    completedDate: z.string().min(1, 'Completed date is required'),
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
    metadata: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.undefined()]),
    ),
  })
  .refine((entry) => !isCompletedBeforeStarted(entry.startedDate, entry.completedDate), {
    message: 'Completed date cannot precede started date',
    path: ['completedDate'],
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
});

const filmMetadataSchema = z.object({
  director: z.string().optional(),
});

const tvMetadataSchema = z.object({
  showTitle: z.string().optional(),
  seasonNumber: z.number().min(1, 'Season number must be at least 1').optional(),
});

const comicMetadataSchema = z
  .object({
    series: z.string().optional(),
    issueStart: z.number().min(1, 'Issue start must be at least 1').optional(),
    issueEnd: z.number().optional(),
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
};

/** Returns the appropriate metadata schema for a given media type id. */
export function getMetadataSchema(mediaTypeId: string): z.ZodType {
  return metadataSchemasByMediaType[mediaTypeId] ?? genericMetadataSchema;
}
