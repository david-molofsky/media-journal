import { db } from '@/services/database/db';
import { nowIso } from '@/utils/dateUtils';
import type { MediaEntry } from '@/models';
import type { NormalizableField } from './dataQualityService';

function replaceListValues(
  values: string[],
  variants: Set<string>,
  canonical: string,
): string[] {
  const replaced = values.map((value) => (variants.has(value) ? canonical : value));
  return Array.from(new Set(replaced));
}

/** Replaces every selected spelling/alias atomically across the journal. */
export async function normalizeEntryValues(
  field: NormalizableField,
  variants: string[],
  canonical: string,
): Promise<number> {
  const variantSet = new Set(variants);
  return db.transaction('rw', db.mediaEntries, async () => {
    const entries = await db.mediaEntries.toArray();
    const changed: MediaEntry[] = [];

    for (const entry of entries) {
      let next: MediaEntry = entry;
      if (field === 'source') {
        const source = entry.metadata?.source;
        if (typeof source === 'string' && variantSet.has(source)) {
          next = { ...entry, metadata: { ...entry.metadata, source: canonical } };
        }
      } else if (
        field === 'genre' &&
        entry.genres?.some((value) => variantSet.has(value))
      ) {
        next = {
          ...entry,
          genres: replaceListValues(entry.genres, variantSet, canonical),
        };
      } else if (field === 'tag' && entry.tags?.some((value) => variantSet.has(value))) {
        next = { ...entry, tags: replaceListValues(entry.tags, variantSet, canonical) };
      }

      if (next !== entry) changed.push({ ...next, updatedAt: nowIso() });
    }

    if (changed.length > 0) await db.mediaEntries.bulkPut(changed);
    return changed.length;
  });
}

function firstDefined<T>(
  entries: MediaEntry[],
  read: (entry: MediaEntry) => T | undefined,
): T | undefined {
  for (const entry of entries) {
    const value = read(entry);
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

/**
 * Consolidates confirmed duplicate records into the chosen keeper.
 * The keeper wins conflicts; complementary metadata, lists and notes
 * are retained. The write and duplicate deletions are one transaction.
 */
export async function mergeDuplicateEntries(
  ids: string[],
  keeperId: string,
): Promise<MediaEntry> {
  return db.transaction('rw', db.mediaEntries, async () => {
    const found = (await db.mediaEntries.bulkGet(ids)).filter(
      (entry): entry is MediaEntry => entry !== undefined,
    );
    const keeper = found.find(({ id }) => id === keeperId);
    if (!keeper || found.length < 2)
      throw new Error('Duplicate entries are no longer available.');
    const others = found.filter(({ id }) => id !== keeperId);
    const preference = [keeper, ...others];
    const notes = Array.from(
      new Set(
        preference
          .map(({ notes: value }) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const merged: MediaEntry = {
      ...keeper,
      rating: firstDefined(preference, ({ rating }) => rating),
      notes: notes.length > 0 ? notes.join('\n\n') : undefined,
      repeatConsumption: preference.some(({ repeatConsumption }) => repeatConsumption),
      tags: Array.from(new Set(preference.flatMap(({ tags }) => tags ?? []))),
      genres: Array.from(new Set(preference.flatMap(({ genres }) => genres ?? []))),
      watchedWith: Array.from(
        new Set(preference.flatMap(({ watchedWith }) => watchedWith ?? [])),
      ),
      recommendedBy: Array.from(
        new Set(preference.flatMap(({ recommendedBy }) => recommendedBy ?? [])),
      ),
      metadata: Object.assign({}, ...[...others, keeper].map(({ metadata }) => metadata)),
      updatedAt: nowIso(),
    };

    await db.mediaEntries.put(merged);
    await db.mediaEntries.bulkDelete(others.map(({ id }) => id));
    return merged;
  });
}
