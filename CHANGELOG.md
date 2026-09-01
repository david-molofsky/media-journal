# Media Journal — Delta 2026-09-01 (part 6)

Bug fix — Wishlist order was silently lost on JSON import.

## Root cause
`wishlistOrder` is a real field on entries (powers the "My Order" Wishlist sort and the
reorder-mode arrow swaps). `exportLibrary()` correctly includes it in every backup, since it just
dumps full entry objects. But `importedEntrySchema` (the Zod schema validating each entry on
import) never declared `wishlistOrder` — and Zod's `.parse()`/`.safeParse()` silently drops any
key not declared in the schema by default. So the field was always present in the exported JSON
file itself, but vanished the moment that file was imported back in — a re-import (or restoring
from a Google Drive backup) would reset every Wishlist entry to unordered.

## Fix
`src/services/importExport/importExportService.ts` — added `wishlistOrder: z.number().optional()`
to `importedEntrySchema`. No other changes needed: the parsed result is spread directly into each
imported entry (`{ ...entryResult.data, ... }`), so once the schema recognizes the field, it flows
through automatically.

## Verification
`npx tsc -b --force`, `npx eslint .`, `npx vite build` all pass clean — same pre-existing warnings
as every prior delivery, nothing new.

## Files changed
- `src/services/importExport/importExportService.ts`

No new npm dependencies, no Dexie migration, no Worker changes.

## Note
If you've already re-imported a backup since this bug existed, any Wishlist entries that lost
their order will need re-sorting once (via the reorder mode) — this fix only prevents it from
happening on future imports, it doesn't recover order that's already been dropped.
