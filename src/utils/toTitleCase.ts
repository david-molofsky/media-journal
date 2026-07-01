/**
 * Capitalises the first letter of each whitespace-separated word
 * without touching the rest of the word. Applied on `onBlur` to all
 * text entry fields except Notes.
 *
 * Why only first-letter and not full title-case? Full title-case
 * (.toLowerCase() then capitalise) would corrupt proper nouns like
 * "McCartney → Mccartney" or "JoJo → Jojo". Uppercasing only the
 * first character per word leaves the rest exactly as typed, so
 * intentional mixed-case is always preserved.
 *
 * Applied on blur rather than on change so the user can type freely
 * mid-word without the cursor fighting the transform.
 */
export function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
