# Media Journal — Delta 2026-09-01

Three features, all confirmed via wireframe before build (see chat).

## 1. Manual ISBN/UPC entry
Applies to all three scan dialogs (Books/Comics ISBN, Comic single-issue UPC, Film UPC).

- **New:** `src/components/forms/ManualCodeEntry.tsx` — shared manual-entry field (ISBN or UPC),
  live format validation, no Search button of its own (each dialog owns that in its existing
  DialogActions).
- **Changed:** `IsbnScanDialog.tsx`, `UpcScanDialog.tsx`, `ComicUpcScanDialog.tsx` — each gains a
  `manual` phase. Entry points: "Type instead" on the initial scanning screen, and on Camera
  denied (replacing the old dead-end "Close"-only state). The previously-stubbed
  "Enter manually instead" button (`onClick={handleClose}`) on error states is now functional,
  relabelled "Edit number" (pre-fills the code just looked up) alongside "Scan instead". Manual
  entry only triggers a lookup on explicit Search tap — no live auto-search as you type. Reuses
  the exact same lookup functions the scan flow already calls, so Found/Not-found/etc. behave
  identically regardless of how the code was entered.

## 2. Wishlist/Completed quick-action reorder
- **Changed:** `EntryForm.tsx` — the status `ToggleButtonGroup` (shared by Add Entry and Edit
  Entry) is now ordered Wishlist → In Progress → Completed, left-to-right matching the entry's
  natural progression and the existing Library tab order. Previously Completed → In Progress →
  Wishlist.

## 3. Bulk remove genres & tags
Source is explicitly out of scope (single free-text value, not a list — stays add/overwrite-only).

- **New:** `src/hooks/useSelectionFieldCounts.ts` — returns every genre/tag present across the
  currently-selected entries with a count of how many have it, reactive via `useLiveQuery`.
- **New:** `src/components/library/RemoveFieldSelect.tsx` — restricted (non-freeSolo) multi-select
  used only in Remove mode; options are scoped to what's actually present in the selection, each
  annotated "N of M".
- **Changed:** `entryService.ts` — new `bulkRemoveTags()` / `bulkRemoveGenres()`, set-difference
  counterparts to the existing `bulkAddTags()` / `bulkAddGenres()`. Only the chosen value(s) are
  stripped from entries that have them; other genres/tags on those entries are untouched.
- **Changed:** `BulkActionBar.tsx` — Genre and Tag dialogs each gain an Add/Remove segmented
  toggle at the top. Switching modes clears whatever was selected. Remove mode's action button is
  red-toned ("Remove genres"/"Remove tags") to distinguish from Add, short of the full-red Delete
  button.

## Verification
`npx tsc -b --force`, `npx eslint .`, `npx vite build` all pass clean. One pre-existing
`react-hooks/incompatible-library` warning in `EntryForm.tsx` (React Hook Form's `watch()`) is
unrelated and untouched, as before. `ManualCodeEntry.tsx` has an expected
`react-refresh/only-export-components` warning (it exports helper functions alongside the
component, same pattern already present in `TopListSort.tsx`) — non-blocking.

## Files changed/added
- `src/components/forms/ManualCodeEntry.tsx` (new)
- `src/components/forms/IsbnScanDialog.tsx`
- `src/components/forms/UpcScanDialog.tsx`
- `src/components/forms/ComicUpcScanDialog.tsx`
- `src/components/forms/EntryForm.tsx`
- `src/components/library/RemoveFieldSelect.tsx` (new)
- `src/components/library/BulkActionBar.tsx`
- `src/hooks/useSelectionFieldCounts.ts` (new)
- `src/services/database/entryService.ts`

No new npm dependencies, no Dexie migration, no Worker changes.
