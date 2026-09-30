/** Firestore can return object fields in a different order from the local snapshot. */
function canonicalJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return item;
    }
    return Object.fromEntries(
      Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
    );
  });
}

export function collectionChanges<T>(
  current: ReadonlyMap<string, unknown>,
  wanted: readonly { id: string; value: T }[],
): { toDelete: string[]; toSet: { id: string; value: T }[] } {
  const wantedIds = new Set(wanted.map(({ id }) => id));
  return {
    toDelete: [...current.keys()].filter((id) => !wantedIds.has(id)),
    toSet: wanted.filter(
      ({ id, value }) =>
        !current.has(id) || canonicalJson(current.get(id)) !== canonicalJson(value),
    ),
  };
}
