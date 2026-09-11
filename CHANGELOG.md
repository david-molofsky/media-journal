# Changelog — Library card: comic issue count + universal title wrap

## Changed
- `src/components/library/EntryCard.tsx`

## What changed

**1. Comic issue-count suffix**
`getTitleSuffix()` now also builds an issue-count segment for Comic entries
when both `issueStart` and `issueEnd` are set (`entrySchemas.ts` already
enforces `issueEnd >= issueStart`, so the count is never negative):
`issueEnd - issueStart + 1` → "9 issues" (singular "1 issue" handled too).
If a Volume is also set, both render together, e.g. "- Vol. 2 - 9 issues".
Colour is the Comic media-type colour (`#F57C00`), same as before.

**2. Title suffix is now a standalone line (Option B, confirmed in chat)**
Previously the season/volume suffix was appended inline to the title text
and only showed at all when a suffix existed (otherwise the title used
`noWrap`, truncating to one line). Now:
- The title always wraps and clamps to a maximum of **3 lines** (2 lines
  when a suffix is present, freeing a guaranteed line for the suffix)
  using `-webkit-line-clamp`, with an ellipsis if it overflows further.
- The season/issue suffix (TV "— S2", Comic "- Vol. X - N issues") renders
  on its own line directly beneath the title, always in full — it can
  never be clipped by the title's line-clamp regardless of title length.

## Why
- Per-request: comics should show a TV-season-style "- X issues" count.
- Per-request: all Library card titles should wrap (not just TV/Comic),
  capped at 3 lines before truncating.
- Per-request: the season/issue suffix must always be visible regardless
  of title length — moving it to its own unclamped line guarantees this
  (confirmed via wireframe, Option B chosen over inline-clamped Option A).

## Verified
- `npx tsc -b --force` — clean
- `npx eslint .` — clean (0 errors; 4 pre-existing warnings in unrelated files)
- `npx vite build` — clean
