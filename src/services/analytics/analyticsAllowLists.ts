import { defaultMediaTypes } from '@/services/database/defaultMediaTypes';
import {
  DEFAULT_SUBSCRIPTION_SOURCES,
} from '@/services/subscriptions/subscriptionSourcesService';

export const DEFAULT_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Non-Fiction',
  'Romance',
  'Sci-Fi',
  'Superhero',
  'Thriller',
  'Biography',
] as const;

const DEFAULT_MEDIA_TYPE_IDS = defaultMediaTypes.map(
  (mediaType) => mediaType.id,
);

const MEDIA_TYPE_ID_SET = new Set(
  DEFAULT_MEDIA_TYPE_IDS.map((value) =>
    value.toLowerCase(),
  ),
);

const GENRE_VALUE_MAP = new Map(
  DEFAULT_GENRES.map((value) => [
    value.toLowerCase(),
    value,
  ]),
);

const sourceOptions = defaultMediaTypes.flatMap(
  (mediaType) =>
    mediaType.fields
      .filter((field) => field.key === 'source')
      .flatMap((field) => field.options ?? []),
);

export const DEFAULT_SOURCES = Array.from(
  new Set([
    ...sourceOptions,
    ...Object.keys(DEFAULT_SUBSCRIPTION_SOURCES),
  ]),
).sort();

const SOURCE_VALUE_MAP = new Map(
  DEFAULT_SOURCES.map((value) => [
    value.toLowerCase(),
    value,
  ]),
);

export function mediaTypeForAnalytics(
  mediaType: string,
): string {
  const normalised = mediaType.trim().toLowerCase();

  if (!normalised) {
    return 'not_set';
  }

  return MEDIA_TYPE_ID_SET.has(normalised)
    ? normalised
    : 'other';
}

export function genreForAnalytics(
  genre: string,
): string {
  const normalised = genre.trim().toLowerCase();

  if (!normalised) {
    return 'not_set';
  }

  return GENRE_VALUE_MAP.get(normalised) ?? 'other';
}

export function genresForAnalytics(
  genres: string[] | undefined,
): string[] {
  if (!genres || genres.length === 0) {
    return ['not_set'];
  }

  return Array.from(
    new Set(
      genres.map((genre) =>
        genreForAnalytics(genre),
      ),
    ),
  );
}

export function sourceForAnalytics(
  source: unknown,
): string {
  if (
    typeof source !== 'string' ||
    !source.trim()
  ) {
    return 'not_set';
  }

  return (
    SOURCE_VALUE_MAP.get(
      source.trim().toLowerCase(),
    ) ?? 'other'
  );
}
