# Changelog — Unify Wishlist/In Progress cards with Completed layout

## Changed
- `src/components/library/EntryCard.tsx`

## What changed
Per chat, Sept 2026, confirmed against a real screenshot ("The Housemaid"
= new design, "Isabella And Blodwen" = old): Wishlist and In Progress
cards now use the same single-row layout as Completed cards, instead of
their own image+title row followed by a separate status-chip row below.

- **Removed**: the "★ Wishlist" / "▶ In Progress" status chip entirely
  (`STATUS_CONFIG` deleted). The separate badge/action row underneath
  the card is gone.
- **Source badge**: now shows inline next to the date for every status
  (previously Completed-only via `completedSource`; Wishlist/In
  Progress showed it in the now-removed row instead). Unified into a
  single `source` variable.
- **Action icons** (Mark finished / Start tracking / Move to wishlist):
  moved into the same slot the rating badge occupies on Completed cards
  — Wishlist/In Progress entries never have a rating, so this is a
  straight swap: rating if present, else the action icons if any apply.
- **Reverts** the Wishlist-specific 48×68 image size and indented badge
  row from the previous change (now unnecessary/superseded) — the
  cover image is back to a flat 44×62 for every status, matching
  Completed exactly, per "align the design with the Completed cards."

## Verified
- `npx tsc -b --force` — clean
- `npx eslint .` — clean (0 errors; 4 pre-existing warnings in unrelated files)
- `npx vite build` — clean
