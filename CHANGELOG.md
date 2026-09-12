# Changelog — Wishlist card: taller image + aligned badge row

## Changed
- `src/components/library/EntryCard.tsx`

## What changed
Wishlist-status cards only — Journal (completed/in-progress) cards are
completely untouched.

- **Badge row alignment**: the Wishlist/Source badge row (previously
  flush under the card's own left padding, i.e. under the cover image)
  now indents to line up under the title/date text instead. Computed
  from the actual rendered thumb width so it stays correct whether an
  entry has a cover image or falls back to the icon circle.
- **Cover image size**: on Wishlist cards, the cover image is slightly
  larger — 44×62 → 48×68, same aspect ratio (~1.1x). The icon-fallback
  circle (entries with no cover image) is unchanged at 44×44, since
  it's a circular badge rather than a poster.
- Date, action icons, and everything else on the card are unchanged.

## Why
Per chat: the badge row read oddly starting under the image rather than
the title, and the cover image could stand to be a touch more
prominent — both scoped to Wishlist only since Journal cards weren't
part of the request.

## Verified
- `npx tsc -b --force` — clean
- `npx eslint .` — clean (0 errors; 4 pre-existing warnings in unrelated files)
- `npx vite build` — clean
