# Media Journal — Delta 2026-09-01 (part 4)

Subscriptions calculator + Timeline consolidation, per the confirmed wireframe (v2). Wireframed,
scoped via multi-round clarifying questions, and confirmed before build — see chat.

## ⚠️ Manual step required — file deletion

Delta zips only add/overwrite files; they can't delete one. After unzipping, **manually delete**:

```
src/pages/Timeline/TimelinePage.tsx
```

(and the now-empty `src/pages/Timeline/` folder, if your unzip tool leaves it behind). The app
will build fine even if you forget — nothing imports it anymore — but it'll sit as dead code
until removed.

## A note on how this build started

Before writing any code, I found my working copy had somehow already diverged from your actual
uploaded zip — `navItems.ts`, `paths.ts`, `TimelinePage.tsx`, and `pageSessionState.ts` already
reflected this exact feature, including comments referencing decisions from this very
conversation that hadn't happened yet when the zip was uploaded. I couldn't explain it and hadn't
made those changes myself. I re-extracted your original zip fresh, confirmed it was genuinely
unmodified (old nav, old Timeline page, none of today's earlier features), verified my three
earlier deltas today were unaffected (built on the clean baseline), and rebuilt everything —
including this feature — from that verified-clean copy. Flagging this in case you want to
double-check your own copies of the earlier deltas, though I'm confident they're unaffected.

## 1. Bottom nav swap + Timeline consolidation

- **`src/components/layout/navItems.ts`** — Timeline's slot (last position) replaced by
  Subscriptions. Final order: Dashboard → Journal → Add → Statistics → Subscriptions.
- **`src/routes/paths.ts`** — `timeline` route removed, `subscriptions: '/subscriptions'` added.
- **`src/routes/AppRoutes.tsx`** — `TimelinePage` lazy import/route removed, `SubscriptionsPage`
  added in its place.
- **`src/pages/Timeline/TimelinePage.tsx`** — deleted (see manual step above). Timeline itself
  isn't gone — it moved fully onto the Statistics page's Timeline tile.
- **`src/state/pageSessionState.ts`** — `TimelineSessionState` (and its
  get/setTimelineSessionState functions) removed; `timelineZoom`/`timelineExcludedTypeIds` added
  to `StatisticsSessionState` instead, since the tile's state now lives there.
- **`src/pages/Statistics/StatisticsPage.tsx`** — the Timeline tile is now fully self-contained:
  gained the real Week/Month/Quarter/Year zoom toggle and the type-filter chips (both reused
  directly from the retired standalone page — `TIMELINE_ZOOM_ORDER`/`TIMELINE_ZOOM_LEVELS` and
  `TimelineTypeFilter.tsx`), replacing the old fixed-at-Year, no-filter, capped-height preview.
  The now-pointless "View full Timeline" button is gone. Filtering happens before packing (same
  as the old standalone page) so hiding a type re-packs the remaining bars tighter.

## 2. Subscriptions calculator

- **New `src/services/subscriptions/subscriptionPricing.ts`** — hardcoded US/UK monthly price
  tier tables for the 9 confirmed services (Netflix, Disney+, Amazon Prime Video, Spotify,
  Audible, Apple TV+, Max [HBO Max/Discovery+], Hulu [US only], NOW TV [UK only, see naming note
  below]). Netflix/Disney+/Apple TV+ UK prices match your approved wireframe's example figures
  exactly; every other figure is a **v1 placeholder estimate** — there's no pricing API for this,
  same as scoped in the Aug 29 session, so these are meant to be corrected via each card's pencil
  icon rather than treated as authoritative. Please spot-check and correct as needed.
- **Naming note:** "NOW TV / Sky (UK)" has no existing matching source string anywhere else in
  the app (`DEFAULT_SUBSCRIPTION_SOURCES`), so I keyed the table under `'NOW TV'` as the most
  likely name — if you actually log entries under `'Sky'` or something else, let me know and I'll
  adjust the key so it matches your real data.
- **New `src/services/subscriptions/subscriptionCostService.ts`** — `getSubscriptionCostSummary()`
  builds the full page dataset: every source flagged in Settings > Subscriptions gets a row, even
  with zero usage this year (the point is tracking what's being paid for, not just what's being
  watched). Usage/value reuses the **exact same Subscription Value formula** as the Statistics
  page (`getSubscriptionValue`), just aggregated across every enabled media type at once rather
  than one Statistics group at a time, per your "reuse the existing formula for v1" call.
  `setSubscriptionTier()`/`setSubscriptionPriceOverride()` persist the two new settings below.
- **New `src/hooks/useSubscriptionCostData.ts`** — reactive wrapper, recomputes on any relevant
  Dexie write. Always a rolling-12-month, unfiltered view — no year/filter controls, unlike
  Statistics' equivalent.
- **New `src/pages/Subscriptions/SubscriptionsPage.tsx`** — summary card (monthly/annual spend +
  overall value), best/worst value chips, per-source cards with a tier dropdown (for the 9
  hardcoded services) or a "no price table — manual entry only" note, and a pencil-icon dialog to
  set/clear a manual price override on any card. Empty state points at Settings > Subscriptions
  when nothing's flagged yet.
- **`src/models/AppSettings.ts`** — two new setting keys: `subscriptionTierSelections` (source →
  tier id) and `subscriptionPriceOverrides` (source → manual monthly price). Country/region reuses
  the **existing** `watchProviderRegion` setting (Settings > Region) rather than a new one, per
  your note that this setting already exists — sources fall back to manual-only pricing entirely
  when the region isn't US or UK.

## A scope decision worth flagging: "hours this year"

The confirmed wireframe's per-card stats row shows both an item count and hours consumed. Only
**Film and TV** entries carry a `runtime` field in this app — no other media type does (Books,
Comics, Podcasts, Games, etc. have no comparable field) — so hours are only computed for
Film/TV-sourced usage, weighted the same way as everywhere else in Statistics. For a
Podcast/Audiobook/Comic subscription, the card shows "Hours not tracked for this type" instead of
a fabricated or zero figure. This wasn't explicitly re-confirmed in scoping, so flagging it
clearly here — happy to revisit (e.g. estimate audiobook hours from a different field) if it
matters to you.

## Verification
`npx tsc -b --force`, `npx eslint .`, `npx vite build` all pass clean on the full reconstructed
codebase (today's earlier three deltas + this one, all together) — same pre-existing warnings as
every prior delivery today, nothing new.

## Files changed
- `src/components/layout/navItems.ts`
- `src/routes/paths.ts`
- `src/routes/AppRoutes.tsx`
- `src/state/pageSessionState.ts`
- `src/pages/Statistics/StatisticsPage.tsx`
- `src/models/AppSettings.ts`

## Files added
- `src/pages/Subscriptions/SubscriptionsPage.tsx`
- `src/services/subscriptions/subscriptionPricing.ts`
- `src/services/subscriptions/subscriptionCostService.ts`
- `src/hooks/useSubscriptionCostData.ts`

## Files to manually delete
- `src/pages/Timeline/TimelinePage.tsx` (and the `src/pages/Timeline/` folder)

No new npm dependencies, no Dexie migration (new settings use the existing key-value
`appSettings` table, no schema change), no Worker changes.
