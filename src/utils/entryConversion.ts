import type { EntryMetadata } from '@/models';

/**
 * Canonical "roles" that metadata fields across different media types
 * can share. Converting an entry from one media type to another (Edit
 * Entry > Convert) maps metadata field-to-field only where both types
 * assign the same role to one of their fields — everything else is
 * dropped from the source or left blank on the target. This is the
 * single source of truth for what "convert to X" carries over; see
 * convertMetadata below and its use in EditEntryPage.
 *
 * Deliberately conservative: a field only gets a role if converting it
 * genuinely preserves meaning (e.g. Book's `author` and Comic's
 * `writer` are usually the same person; Film's `runtime` and TV's
 * `runtime` are both minutes). Fields with no natural equivalent
 * elsewhere (Comic's `penciller`, TV's `network`, ...) are left
 * roleless — they never carry over, in either direction.
 */
export type FieldRole =
  | 'creator'
  | 'series'
  | 'volume'
  | 'source'
  | 'cast'
  | 'unitStart'
  | 'unitEnd'
  | 'runtime'
  | 'overview'
  | 'posterPath';

/** metadata field key -> role, per media type id. Kept in sync with
 * defaultMediaTypes.ts's `fields[]` plus the bespoke (non-fields[])
 * keys each type's schema also accepts — see entrySchemas.ts. */
const FIELD_ROLES: Record<string, Record<string, FieldRole>> = {
  book: { author: 'creator', series: 'series', volume: 'volume', source: 'source' },
  audiobook: { author: 'creator', series: 'series', volume: 'volume', source: 'source' },
  film: {
    director: 'creator',
    cast: 'cast',
    source: 'source',
    runtime: 'runtime',
    series: 'series',
    overview: 'overview',
    posterPath: 'posterPath',
  },
  tv: {
    episodeStart: 'unitStart',
    episodeEnd: 'unitEnd',
    creator: 'creator',
    cast: 'cast',
    source: 'source',
    runtime: 'runtime',
    series: 'series',
    overview: 'overview',
    posterPath: 'posterPath',
  },
  comic: {
    series: 'series',
    issueStart: 'unitStart',
    issueEnd: 'unitEnd',
    source: 'source',
    writer: 'creator',
  },
  magazine: { series: 'series', issueStart: 'unitStart', issueEnd: 'unitEnd', source: 'source' },
  game: { source: 'source' },
  podcast: { source: 'source' },
  art: { source: 'source' },
  theatre: { source: 'source' },
  // Added alongside their new `series` fields for "Find Next in
  // Series" (see chat, Aug 2026) — previously absent from this map
  // entirely, so Convert never carried genre/creator-adjacent series
  // info for these two types.
  anime: { series: 'series', source: 'source' },
  manga: { author: 'creator', series: 'series', source: 'source' },
};

export function fieldRolesFor(mediaTypeId: string): Record<string, FieldRole> {
  return FIELD_ROLES[mediaTypeId] ?? {};
}

export interface ConversionPreview {
  /** Same role, same field key on both sides — value carries over unchanged. */
  carried: { targetKey: string; sourceKey: string }[];
  /** Same role, different field key — value carries over under a new name. */
  renamed: { targetKey: string; sourceKey: string }[];
  /** Source field keys (with a value) that have no role match on the target type. */
  dropped: string[];
  /** Target field keys that start blank because no source field shares their role. */
  blank: string[];
  /** The computed metadata for the target type, ready to save. */
  metadata: EntryMetadata;
}

/**
 * Builds both the converted metadata and a breakdown of what happened,
 * from `sourceMetadata` (only keys with a defined, non-empty value are
 * considered) to `targetFieldKeys` (the target type's full field list,
 * as shown in Edit Entry).
 */
export function convertMetadata(
  sourceTypeId: string,
  targetTypeId: string,
  sourceMetadata: EntryMetadata,
  targetFieldKeys: string[],
): ConversionPreview {
  const sourceRoles = fieldRolesFor(sourceTypeId);
  const targetRoles = fieldRolesFor(targetTypeId);

  // role -> source field key, only for fields that actually have a value.
  const roleToSourceKey = new Map<FieldRole, string>();
  for (const [key, role] of Object.entries(sourceRoles)) {
    const value = sourceMetadata[key];
    if (value !== undefined && value !== '') roleToSourceKey.set(role, key);
  }

  const metadata: EntryMetadata = {};
  const carried: { targetKey: string; sourceKey: string }[] = [];
  const renamed: { targetKey: string; sourceKey: string }[] = [];
  const blank: string[] = [];
  const matchedSourceKeys = new Set<string>();

  for (const targetKey of targetFieldKeys) {
    const role = targetRoles[targetKey];
    const sourceKey = role ? roleToSourceKey.get(role) : undefined;
    if (role && sourceKey) {
      metadata[targetKey] = sourceMetadata[sourceKey];
      matchedSourceKeys.add(sourceKey);
      if (sourceKey === targetKey) carried.push({ targetKey, sourceKey });
      else renamed.push({ targetKey, sourceKey });
    } else {
      blank.push(targetKey);
    }
  }

  const dropped = Object.keys(sourceMetadata).filter(
    (key) =>
      sourceMetadata[key] !== undefined && sourceMetadata[key] !== '' && !matchedSourceKeys.has(key),
  );

  return { carried, renamed, dropped, blank, metadata };
}
