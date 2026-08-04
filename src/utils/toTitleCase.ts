/**
 * Capitalises the first letter of each word — where a "word" starts
 * at the beginning of the string, or after whitespace or a hyphen —
 * without touching the rest of the word. Applied on `onBlur` to all
 * text entry fields except Notes.
 *
 * Why only first-letter and not full title-case? Full title-case
 * (.toLowerCase() then capitalise) would corrupt proper nouns like
 * "McCartney → Mccartney" or "JoJo → Jojo". Uppercasing only the
 * first character per word leaves the rest exactly as typed, so
 * intentional mixed-case is always preserved.
 *
 * Deliberately NOT using a plain `\b\w` regex — `\b` word boundaries
 * treat *any* non-word character (including apostrophes) as a word
 * start, which corrupted contractions like "don't" -> "Don'T". Only
 * whitespace, hyphens, and the start of the string count as word
 * starts here, so apostrophes are left alone while hyphenated words
 * (e.g. "well-known" -> "Well-Known") still get both halves capitalised.
 *
 * Applied on blur rather than on change so the user can type freely
 * mid-word without the cursor fighting the transform.
 */
export function toTitleCase(value: string): string {
  return value.replace(/(^|[\s-])(\w)/g, (_match, boundary: string, char: string) => boundary + char.toUpperCase());
}
