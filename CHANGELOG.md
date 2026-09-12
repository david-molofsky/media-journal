# Changelog — Graphic Novel toggle + Subscription price/score value metric

## Changed
- `src/services/validation/entrySchemas.ts`
- `src/components/forms/EntryForm.tsx`
- `src/components/library/EntryCard.tsx`
- `src/services/subscriptions/subscriptionCostService.ts`
- `src/pages/Subscriptions/SubscriptionsPage.tsx`

## 1. Graphic Novel toggle (Comic entries)

- **`entrySchemas.ts`**: added `isGraphicNovel: z.boolean().optional()` to
  `comicMetadataSchema`. Bespoke field (like `coverImagePath`), not added
  to `defaultMediaTypes.ts`'s `fields[]` array.
- **`EntryForm.tsx`**: a "Graphic Novel" switch now renders directly
  below Issue Start/Issue End on Comic entries. When checked:
  - Issue Start/Issue End hide from the form. Any existing values stay
    stored underneath, untouched — unchecking brings them back exactly
    as they were.
  - If Issue Start wasn't already a number, it's silently set to `1` —
    purely so "Fetch issue details from ComicVine" (which is keyed off
    Issue Start) keeps working without asking for a field the person
    never wanted to fill in. Issue End is left alone either way.
  - The "Issues X–Y count as N issues" hint is suppressed.
  - The single-issue UPC/barcode scanner is untouched, still visible.
- **`EntryCard.tsx`**: the Library card suffix shows "- Graphic Novel"
  instead of an issue count for these entries (Volume, if set, still
  shows alongside it, e.g. "- Vol. 2 - Graphic Novel"). Also switched
  the issue-count math to the shared `comicIssueCount()` util instead
  of a duplicated inline calculation.
- **Statistics**: no changes needed. `getEntryWeight()` already falls
  back to counting a comic as 1 item whenever Issue End isn't a number,
  which every Graphic Novel entry satisfies.

## 2. Subscriptions page — price ÷ score value metric

- **`subscriptionCostService.ts`**: added `costPerValuePoint` to
  `SubscriptionCostRow` — `effectivePrice / score`, `null` when there's
  no price or the row doesn't clear the usage threshold. Deliberately
  separate from `score`/the Good-Fair-Poor label, which stay
  usage-and-rating only. `bestValueSource`/`worstValueSource` in
  `getSubscriptionCostSummary` now pick the lowest/highest
  `costPerValuePoint` instead of the highest/lowest raw score —
  price-aware for the first time. `overallValueLabel` is unchanged
  (still the usage/rating average).
- **`SubscriptionsPage.tsx`**: each card shows a new "£X.XX/pt" chip
  next to its Good/Fair/Poor label. The page summary's "Best value" /
  "Worst value" chips now include the figure too, e.g.
  "Best value: Digital — £0.10/pt". The "hrs (Film/TV) last 12mo" stat
  is untouched.
- **`getEntryWeight()`** and every other Statistics consumer of it are
  completely untouched — this only touches the Subscriptions
  calculator's own value metric, per chat.

## Verified
- `npx tsc -b --force` — clean
- `npx eslint .` — clean (0 errors; 4 pre-existing warnings in unrelated files)
- `npx vite build` — clean
