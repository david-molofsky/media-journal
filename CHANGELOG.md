# Media Journal — Delta 2026-09-01 (part 5)

Bug fix, found while helping with the Sci-Fi/Sci-fi genre merge.

## Root cause
`GenreInput.tsx`'s `normalise` function split only on whitespace (`\s+`), so a hyphenated genre
like "Sci-Fi" was treated as one single "word" — it capitalized just the leading S and lowercased
everything after it, including the F. Typing "Sci-Fi" (or "SCI-FI", or anything else) always
silently became "Sci-Fi" -> "Sci-fi", no matter what was typed. This is what created the
Sci-Fi/Sci-fi duplicate pair in the first place — not a one-off typo, a real bug that would keep
recreating it. `toTitleCase.ts` (used for Title/Author/Director and every other text field)
already handled hyphens correctly — GenreInput had its own separate, older normalizer that never
got the same treatment.

## Fix
`src/components/forms/GenreInput.tsx` — `normalise` now splits on both spaces and hyphens
(capturing the separators so they're preserved exactly), title-casing each segment independently.
"Sci-Fi" now stays "Sci-Fi"; "well-known" -> "Well-Known"; multi-word genres like "Non-Fiction" or
"Action Adventure" behave the same as before.

## Verification
`npx tsc -b --force`, `npx eslint .`, `npx vite build` all pass clean — same pre-existing
warnings as every prior delivery today, nothing new.

## Files changed
- `src/components/forms/GenreInput.tsx`

No new npm dependencies, no Dexie migration, no Worker changes.

## Follow-up
You'll still need to do the one-time bulk merge (add "Sci-Fi", remove "Sci-fi" via the bulk
Genre dialog) to clean up entries already affected — this fix only stops it from happening again
going forward.
