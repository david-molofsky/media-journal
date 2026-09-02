/**
 * Shared normalisation for the "Watched With" / "Recommended By" chip
 * inputs. Unlike Tags (lowercased) and Genres (Title Cased), a
 * person's name is left exactly as typed — trimmed and with internal
 * whitespace collapsed, nothing more — since there's no single
 * "correct" casing to force onto a name the way there is for a tag or
 * genre label.
 *
 * Deduping is still case-insensitive (so "Sarah" and "sarah" don't
 * both end up as separate chips on the same entry), but keeps
 * whichever casing was typed first — see `dedupePersonNames`.
 */
export function normalisePersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Case-insensitively dedupes a list of names, keeping the first
 * occurrence's casing and dropping empties. */
export function dedupePersonNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = normalisePersonName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}
