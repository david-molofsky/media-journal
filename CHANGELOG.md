# Changelog — Library card: comic issue count + universal title wrap

## Changed
- `src/components/library/EntryCard.tsx`

## What changed

**1. Comic issue-count suffix**
`getTitleSuffix()` builds an issue-count segment for Comic entries when
both `issueStart` and `issueEnd` are set (`entrySchemas.ts` already
enforces `issueEnd >= issueStart`, so the count is never negative):
`issueEnd - issueStart + 1` → "9 issues" (singular "1 issue" handled too).
If a Volume is also set, both render together, e.g. "- Vol. 2 - 9 issues".
Colour is the Comic media-type colour (`#F57C00`), same as before.

**2. All titles wrap, suffix flows inline with the title (max 3 lines)**
Every Library card title now wraps and clamps to a maximum of 3 lines
(`-webkit-line-clamp: 3`) instead of truncating to one line — previously
only TV/Comic titles with a suffix wrapped at all.

The season/issue suffix (TV "— S2", Comic "- Vol. X - N issues") is
appended inline at the end of the title text, flowing and wrapping
naturally with it, landing on the same line when there's room and only
dropping to the next line when there isn't (confirmed against a real
screenshot — forcing it onto its own line, even when title + suffix
comfortably fit together, read worse in practice).

## Why
- Per-request: comics should show a TV-season-style "- X issues" count.
- Per-request: all Library card titles should wrap (not just TV/Comic),
  capped at 3 lines before truncating.
- Per-request (after seeing it live): the suffix should stay on the same
  line as the title whenever it fits, rather than always being pushed to
  its own line underneath.

## Verified
- `npx tsc -b --force` — clean
- `npx eslint .` — clean (0 errors; 4 pre-existing warnings in unrelated files)
- `npx vite build` — clean
