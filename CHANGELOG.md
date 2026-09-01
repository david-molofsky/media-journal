# Media Journal — Delta 2026-09-01 (part 7)

Reverts the 3-month moving-average trend line, switches the Monthly chart to a rolling 12-month
window instead of a fixed calendar year — applied to **both** places that share this chart
(Dashboard and Statistics page's Monthly tab), per your call.

## What changed and why

`MonthlyActivityChart` was previously tied to whichever calendar year was selected on each page
(Jan–Dec of that year), always displayed in that fixed Jan→Dec order. It's now a self-contained,
trailing-12-months chart — e.g. run today (Sept 2026), it always shows Sep '25 through Sep '26,
in that chronological order, **independent of any year selector** either page has for its other
stats. Recomputed fresh on every load/query (no caching), which is what makes it "roll" day to
day without extra scheduling logic — ask again tomorrow, or in October, and the window has moved
because it's built off the current date each time.

- **`src/services/statistics/statisticsService.ts`** — new `getRollingMonthlyBreakdown(filters?)`,
  returning 12 `{ year, month, label, count }` entries. Replaces the old `getMonthlyTrend` stub
  entirely (it had zero callers anywhere, confirmed by grep last session) — that dead code is now
  actually gone rather than just flagged, since this rework directly supersedes it.
- **New `src/hooks/useRollingMonthlyBreakdown.ts`** — reactive wrapper shared by both pages.
- **`src/components/charts/MonthlyActivityChart.tsx`** — reverted from `ComposedChart`+`Line`
  back to a plain `BarChart`, no trend line. Prop changed from `monthlyBreakdown: Record<number,
  number>` to `data: RollingMonthDatum[]`; `onSelectMonth` now takes `(year, month)` instead of
  just `month` — necessary since a rolling window spans two calendar years, so month number alone
  ("Sep") would be ambiguous between this September and last.
- **`src/components/statistics/TrendsTabs.tsx`** — prop threaded through as `monthlyData`/
  `onSelectMonth(year, month)` to match.
- **`src/pages/Statistics/StatisticsPage.tsx`** — new `rollingMonthlyData` from the hook (passing
  the page's existing filter bar state, but *not* its year selector — the Monthly tab now always
  shows the rolling window regardless of which year is picked at the top of the page). Click
  handler simplified to always pass both `year` and `month` from the tapped bar directly.
- **`src/pages/Dashboard/DashboardPage.tsx`** — same pattern, no filters (matching its previous
  behaviour, which also had no filters).

## A pre-existing thing I left alone, flagging it

Dashboard's month-click handler has never explicitly forced `status: 'completed'` on the Library
filter it navigates to (unlike Statistics' equivalent, which does) — I preserved that exact
behaviour rather than silently changing it while I was already touching this handler. Worth a
look if it's not intentional, but out of scope for what was asked here.

## Verification
`npx tsc -b --force`, `npx eslint .`, `npx vite build` all pass clean — same pre-existing warnings
as every prior delivery, nothing new.

## Files changed
- `src/services/statistics/statisticsService.ts`
- `src/components/charts/MonthlyActivityChart.tsx`
- `src/components/statistics/TrendsTabs.tsx`
- `src/pages/Statistics/StatisticsPage.tsx`
- `src/pages/Dashboard/DashboardPage.tsx`

## Files added
- `src/hooks/useRollingMonthlyBreakdown.ts`

No new npm dependencies, no Dexie migration, no Worker changes.
