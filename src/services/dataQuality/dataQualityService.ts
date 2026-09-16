import type { MediaEntry } from '@/models';

export type NormalizableField = 'source' | 'genre' | 'tag';

export interface DuplicateGroup {
  key: string;
  entries: MediaEntry[];
  repeatImportConflict: boolean;
}

export interface ValueVariation {
  field: NormalizableField;
  canonical: string;
  variants: string[];
  entryCount: number;
}

export interface IncompleteEntryIssue {
  entry: MediaEntry;
  missing: Array<'completion date' | 'media type'>;
}

export interface DataHealthReport {
  duplicates: DuplicateGroup[];
  variations: ValueVariation[];
  incompleteEntries: IncompleteEntryIssue[];
  issueCount: number;
}

const IMPORTED_FROM_PREFIX = 'imported from ';
const SOURCE_ALIASES: Record<string, string> = {
  'amazon prime': 'Amazon Prime Video',
  'amazon prime video': 'Amazon Prime Video',
  'prime video': 'Amazon Prime Video',
};

function comparable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function presentationScore(value: string): number {
  const uppercase = (value.match(/[A-Z]/g) ?? []).length;
  const separators = (value.match(/[-&/]/g) ?? []).length;
  return uppercase * 2 + separators;
}

function titleKey(entry: MediaEntry): string {
  const consumption =
    entry.status === 'completed' ? (entry.completedDate ?? 'no-date') : entry.status;
  return `${comparable(entry.title)}::${comparable(entry.mediaType)}::${consumption}`;
}

function importSources(entry: MediaEntry): string[] {
  return (entry.tags ?? [])
    .map((tag) => tag.trim().toLocaleLowerCase())
    .filter((tag) => tag.startsWith(IMPORTED_FROM_PREFIX));
}

function analyseDuplicates(entries: MediaEntry[]): DuplicateGroup[] {
  const groups = new Map<string, MediaEntry[]>();
  for (const entry of entries) {
    const key = titleKey(entry);
    if (!comparable(entry.title) || !comparable(entry.mediaType)) continue;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.entries())
    .filter(([, matches]) => matches.length > 1)
    .map(([key, matches]) => {
      const sources = new Set(matches.flatMap(importSources));
      const externalIds = new Set(
        matches.flatMap((entry) =>
          Object.entries(entry.metadata ?? [])
            .filter(([name, value]) => /id$/i.test(name) && value !== undefined)
            .map(([name, value]) => `${name}:${String(value)}`),
        ),
      );
      return {
        key,
        entries: [...matches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        repeatImportConflict: sources.size > 1 || externalIds.size > 1,
      };
    })
    .sort((a, b) => a.entries[0]!.title.localeCompare(b.entries[0]!.title));
}

interface ValueOccurrence {
  raw: string;
  entryId: string;
}

function analyseValues(
  entries: MediaEntry[],
  field: NormalizableField,
): ValueVariation[] {
  const occurrences: ValueOccurrence[] = [];
  for (const entry of entries) {
    const values =
      field === 'source'
        ? [entry.metadata?.source].filter(
            (value): value is string => typeof value === 'string',
          )
        : field === 'genre'
          ? (entry.genres ?? [])
          : (entry.tags ?? []);
    for (const raw of values) {
      if (raw.trim()) occurrences.push({ raw: raw.trim(), entryId: entry.id });
    }
  }

  const groups = new Map<string, ValueOccurrence[]>();
  for (const occurrence of occurrences) {
    const normalized = comparable(occurrence.raw);
    const key =
      field === 'source'
        ? comparable(SOURCE_ALIASES[normalized] ?? occurrence.raw)
        : normalized;
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }

  return Array.from(groups.values())
    .map((matches): ValueVariation | null => {
      const variants = Array.from(new Set(matches.map(({ raw }) => raw)));
      const alias =
        field === 'source' ? SOURCE_ALIASES[comparable(variants[0] ?? '')] : undefined;
      if (variants.length < 2 && (!alias || variants[0] === alias)) return null;
      const canonical =
        alias ??
        [...variants].sort((a, b) => {
          const countA = matches.filter(({ raw }) => raw === a).length;
          const countB = matches.filter(({ raw }) => raw === b).length;
          return (
            countB - countA ||
            presentationScore(b) - presentationScore(a) ||
            a.localeCompare(b)
          );
        })[0]!;
      return {
        field,
        canonical,
        variants: variants.filter((variant) => variant !== canonical).sort(),
        entryCount: new Set(matches.map(({ entryId }) => entryId)).size,
      };
    })
    .filter((variation): variation is ValueVariation => variation !== null)
    .sort(
      (a, b) => b.entryCount - a.entryCount || a.canonical.localeCompare(b.canonical),
    );
}

export function analyseDataHealth(entries: MediaEntry[]): DataHealthReport {
  const duplicates = analyseDuplicates(entries);
  const variations = (['source', 'genre', 'tag'] as const).flatMap((field) =>
    analyseValues(entries, field),
  );
  const incompleteEntries = entries
    .map((entry): IncompleteEntryIssue | null => {
      const missing: IncompleteEntryIssue['missing'] = [];
      if (!entry.mediaType?.trim()) missing.push('media type');
      if (entry.status === 'completed' && !entry.completedDate)
        missing.push('completion date');
      return missing.length > 0 ? { entry, missing } : null;
    })
    .filter((issue): issue is IncompleteEntryIssue => issue !== null);

  return {
    duplicates,
    variations,
    incompleteEntries,
    issueCount: duplicates.length + variations.length + incompleteEntries.length,
  };
}
