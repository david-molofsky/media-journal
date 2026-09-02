import { db } from '@/services/database/db';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { listEnabledMediaTypes } from '@/services/database/mediaTypeService';
import {
  getEntryWeight,
  getTvTrackingMode,
  sourceOf,
  isWithinYearScope,
  type StatsYearScope,
} from '@/services/statistics/statisticsService';
import {
  getSubscriptionValue,
  getGoodValueHistory,
  type SubscriptionValueTopTitle,
  type GoodValueStatus,
} from '@/services/statistics/subscriptionValueService';
import {
  getSubscriptionSourceConfig,
  isSubscriptionSource,
} from '@/services/subscriptions/subscriptionSourcesService';
import {
  tiersFor,
  pricingRegionFor,
  type SubscriptionTier,
  type SupportedPricingRegion,
} from '@/services/subscriptions/subscriptionPricing';

/** A source's billing cycle (Subscriptions calculator price editor) —
 * see `subscriptionBillingCycle`/`subscriptionAnnualPrices` in
 * AppSettings.ts. Missing/absent means `'monthly'`. */
export type SubscriptionBillingCycle = 'monthly' | 'annual';

/** Only Film and TV entries carry a `runtime` (minutes) field today —
 * see defaultMediaTypes.ts. Every other media type simply doesn't
 * contribute to `hoursThisYear`, rather than guessing a runtime for
 * books/comics/podcasts/games. Flagged in the UI per-card rather than
 * silently showing 0, so it reads as "not tracked" not "zero hours
 * watched". See chat, Sept 2026. */
const RUNTIME_MEDIA_TYPE_IDS = ['film', 'tv'];

/** Resolved billing details for a row, present whenever `billingCycle
 * === 'annual'` and an annual price has actually been entered —
 * `effectivePrice` on the row is already the divided-by-12 figure;
 * this is only the extra detail the price editor and card need to
 * *display* the annual price and what it saves. `monthlyBaseline` is
 * the tier price or monthly override to compare against, when one
 * exists — `savingsPercent`/`savingsAmount` are `null` without one,
 * since there's nothing to compare the annual plan against. */
export interface SubscriptionAnnualBillingInfo {
  annualPrice: number;
  monthlyBaseline: number | null;
  savingsAmount: number | null;
  savingsPercent: number | null;
}

export interface SubscriptionCostRow {
  source: string;
  /** Weighted Completed-entry count within the selected time scope
   * (see `getSubscriptionCostSummary`'s `year` parameter), across
   * every enabled media type — reuses the exact same Subscription
   * Score formula/weighting as the Statistics page (see chat: "reuse
   * the existing formula for v1"), just aggregated per source rather
   * than per Statistics group. */
  watchedCount: number;
  avgRating: number | null;
  /** Count of Wishlist + In Progress entries — always current-state,
   * never scoped by the time-scope selector (see chat, Sept 2026: a
   * backlog is a "now" question, same reasoning as elsewhere in the
   * app). */
  queuedCount: number;
  /** 0–100 blended score, identical formula to Statistics'
   * Subscription Score cards, computed within the selected time
   * scope. */
  score: number;
  belowThreshold: boolean;
  /** Up to 3 highest-rated titles on this source within the selected
   * time scope — same data Statistics' cards show under "Top rated
   * on <source>". */
  topTitles: SubscriptionValueTopTitle[];
  /** Most recent month this source's *trailing-12-month* score
   * cleared "Good value" — always computed across all-time history,
   * independent of the page's time-scope selector (see
   * `getGoodValueHistory`'s doc comment for why). */
  goodValueHistory: GoodValueStatus;
  /** Weighted hours from Film/TV entries only within the rolling
   * 12-month window — `null` (not `0`) when this source has no
   * Film/TV usage at all in the window, so the UI can distinguish
   * "genuinely nothing watched" from "this source doesn't carry
   * runtime data". Deliberately always rolling-12, not the page's
   * time-scope selector — see chat. */
  hoursThisYear: number | null;
  /** Tier options for this source in the current pricing region, or
   * `undefined` if none exist (self-hosted source, or a hardcoded
   * service not offered in this region). */
  tiers: SubscriptionTier[] | undefined;
  selectedTierId: string | null;
  billingCycle: SubscriptionBillingCycle;
  /** Set only when `billingCycle === 'annual'` and an annual price has
   * been entered — see `SubscriptionAnnualBillingInfo`. */
  annualBilling: SubscriptionAnnualBillingInfo | null;
  /** Resolved monthly price actually used in spend totals: the annual
   * price divided by 12 when billed annually, else the manual monthly
   * override if set, else the selected tier's price, else `null` if
   * none of those exist (needs manual entry — and, per chat, a row
   * with no price sorts last and shows no value chip). */
  effectivePrice: number | null;
  isOverridden: boolean;
}

export interface SubscriptionCostSummary {
  rows: SubscriptionCostRow[];
  /** Sum of every row's `effectivePrice` that isn't `null`. Rows
   * missing a price simply don't contribute — not treated as £0,
   * which would understate spend silently. */
  monthlySpend: number;
  annualSpend: number;
  /** `null` if there's no row with both a price and enough usage to
   * clear `belowThreshold` — nothing to judge value against yet. */
  overallValueLabel: 'Good' | 'Fair' | 'Poor' | null;
  bestValueSource: string | null;
  worstValueSource: string | null;
  pricingRegion: SupportedPricingRegion | null;
}

/** Sums weighted Film/TV runtime hours per source within the rolling
 * 12-month window. Kept separate from `getSubscriptionValue` (which
 * only knows about weighted *counts*, not runtime) rather than
 * extending that shared function — Statistics' own cards never needed
 * hours, so bolting it on there would be a v1-only concern leaking
 * into a function three other places already depend on. */
async function getHoursBySource(
  subsConfig: Record<string, boolean>,
  tvMode: Awaited<ReturnType<typeof getTvTrackingMode>>,
): Promise<Map<string, number>> {
  const entries = await db.mediaEntries
    .where('mediaType')
    .anyOf(RUNTIME_MEDIA_TYPE_IDS)
    .toArray();

  const hours = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status && entry.status !== 'completed') continue;
    if (!isWithinYearScope(entry.completedDate, 'last12')) continue;
    const source = sourceOf(entry);
    if (!source || !isSubscriptionSource(subsConfig, source)) continue;
    const runtime = entry.metadata.runtime;
    if (typeof runtime !== 'number' || runtime <= 0) continue;
    const weight = getEntryWeight(entry, tvMode);
    const addedHours = (runtime * weight) / 60;
    hours.set(source, (hours.get(source) ?? 0) + addedHours);
  }
  return hours;
}

/**
 * Builds the full Subscriptions calculator dataset: every source
 * flagged as a subscription (Settings > Subscriptions), each with its
 * usage/score (reusing the existing Subscription Score formula,
 * aggregated across every enabled media type rather than one
 * Statistics group at a time) within the given `year` time scope,
 * tier/price resolution — including any annual-billing discount — for
 * the current pricing region, and the monthly/annual spend +
 * best/worst value summary shown at the top of the page.
 *
 * `year` defaults to `'last12'`, matching this page's behaviour before
 * the time-scope selector existed. It only rescopes usage/rating/score/
 * top-titles (via `getSubscriptionValue`) — queued count, hours, price
 * and spend all stay current-state regardless of `year`, per chat
 * (Sept 2026): a backlog and a price are "now" questions, not "back
 * then" ones. Good-value history is likewise independent of `year` —
 * see `getGoodValueHistory`.
 *
 * A flagged source with zero usage in the selected scope still gets a
 * row — the point is tracking what's being paid for, not just what's
 * being watched, so a subscription sitting unused is exactly the kind
 * of thing this page should surface rather than hide. Rows with no
 * resolved price sort after every priced row (still in source-name
 * order within each group) — see chat: a value judgement needs a cost
 * to weigh against, so there's nothing to rank them against yet.
 */
export async function getSubscriptionCostSummary(
  year: StatsYearScope = 'last12',
): Promise<SubscriptionCostSummary> {
  const [
    subsConfig,
    watchProviderRegion,
    tierSelections,
    priceOverrides,
    billingCycles,
    annualPrices,
    mediaTypes,
    tvMode,
  ] = await Promise.all([
    getSubscriptionSourceConfig(),
    getSetting<string>('watchProviderRegion', 'GB'),
    getSetting<Record<string, string>>('subscriptionTierSelections', {}),
    getSetting<Record<string, number>>('subscriptionPriceOverrides', {}),
    getSetting<Record<string, SubscriptionBillingCycle>>('subscriptionBillingCycle', {}),
    getSetting<Record<string, number>>('subscriptionAnnualPrices', {}),
    listEnabledMediaTypes(),
    getTvTrackingMode(),
  ]);

  const region = pricingRegionFor(watchProviderRegion);
  const allMediaTypeIds = mediaTypes.map((mt) => mt.id);

  const [{ rows: valueRows }, hoursBySource, goodValueHistory] = await Promise.all([
    getSubscriptionValue(allMediaTypeIds, year),
    getHoursBySource(subsConfig, tvMode),
    getGoodValueHistory(allMediaTypeIds),
  ]);

  const valueBySource = new Map(valueRows.map((row) => [row.source, row]));
  const flaggedSources = Object.entries(subsConfig)
    .filter(([, isSub]) => isSub)
    .map(([source]) => source)
    .sort();

  const rows: SubscriptionCostRow[] = flaggedSources.map((source) => {
    const valueRow = valueBySource.get(source);
    const tiers = tiersFor(source, region);
    const selectedTierId =
      tierSelections[source] ??
      (tiers && tiers.length > 0 ? (tiers[0]?.id ?? null) : null);
    const selectedTier = tiers?.find((t) => t.id === selectedTierId);
    const override = priceOverrides[source];
    const monthlyBaseline =
      typeof override === 'number' ? override : (selectedTier?.monthlyPrice ?? null);

    const billingCycle = billingCycles[source] ?? 'monthly';
    const annualPrice = annualPrices[source];
    let effectivePrice: number | null;
    let isOverridden: boolean;
    let annualBilling: SubscriptionAnnualBillingInfo | null = null;

    if (billingCycle === 'annual' && typeof annualPrice === 'number') {
      effectivePrice = annualPrice / 12;
      isOverridden = true;
      const savingsAmount =
        monthlyBaseline !== null ? monthlyBaseline * 12 - annualPrice : null;
      const savingsPercent =
        monthlyBaseline !== null && monthlyBaseline > 0
          ? (savingsAmount! / (monthlyBaseline * 12)) * 100
          : null;
      annualBilling = { annualPrice, monthlyBaseline, savingsAmount, savingsPercent };
    } else {
      effectivePrice = monthlyBaseline;
      isOverridden = typeof override === 'number';
    }

    return {
      source,
      watchedCount: valueRow?.watchedCount ?? 0,
      avgRating: valueRow?.avgRating ?? null,
      queuedCount: valueRow?.queuedCount ?? 0,
      score: valueRow?.score ?? 0,
      belowThreshold: valueRow?.belowThreshold ?? true,
      topTitles: valueRow?.topTitles ?? [],
      goodValueHistory: goodValueHistory.get(source) ?? { state: 'never', month: null },
      hoursThisYear: hoursBySource.get(source) ?? null,
      tiers,
      selectedTierId,
      billingCycle,
      annualBilling,
      effectivePrice,
      isOverridden,
    };
  });

  // Priced rows first (source-name order, from `flaggedSources.sort()`
  // above, preserved by this being a stable sort), every priceless row
  // after — see chat, Sept 2026.
  rows.sort(
    (a, b) => Number(a.effectivePrice === null) - Number(b.effectivePrice === null),
  );

  const pricedRows = rows.filter((r) => r.effectivePrice !== null);
  const monthlySpend = pricedRows.reduce((sum, r) => sum + (r.effectivePrice ?? 0), 0);
  const annualSpend = monthlySpend * 12;

  const eligibleForValue = rows.filter(
    (r) => !r.belowThreshold && r.effectivePrice !== null,
  );
  let overallValueLabel: SubscriptionCostSummary['overallValueLabel'] = null;
  let bestValueSource: string | null = null;
  let worstValueSource: string | null = null;
  if (eligibleForValue.length > 0) {
    const avgScore =
      eligibleForValue.reduce((sum, r) => sum + r.score, 0) / eligibleForValue.length;
    overallValueLabel = avgScore >= 60 ? 'Good' : avgScore >= 40 ? 'Fair' : 'Poor';
    const best = eligibleForValue.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = eligibleForValue.reduce((a, b) => (b.score < a.score ? b : a));
    bestValueSource = best.source;
    worstValueSource = eligibleForValue.length > 1 ? worst.source : null;
  }

  return {
    rows,
    monthlySpend,
    annualSpend,
    overallValueLabel,
    bestValueSource,
    worstValueSource,
    pricingRegion: region,
  };
}

/** Persists a tier selection for `source`, preserving every other
 * source's selection already stored. */
export async function setSubscriptionTier(source: string, tierId: string): Promise<void> {
  const current = await getSetting<Record<string, string>>(
    'subscriptionTierSelections',
    {},
  );
  await setSetting('subscriptionTierSelections', { ...current, [source]: tierId });
}

/** Persists a manual price override for `source`, or clears it when
 * `price` is `null` (reverting to whatever the selected tier
 * resolves to, if any). */
export async function setSubscriptionPriceOverride(
  source: string,
  price: number | null,
): Promise<void> {
  const current = await getSetting<Record<string, number>>(
    'subscriptionPriceOverrides',
    {},
  );
  const next = { ...current };
  if (price === null) {
    delete next[source];
  } else {
    next[source] = price;
  }
  await setSetting('subscriptionPriceOverrides', next);
}

/** Sets `source`'s billing cycle, preserving every other source's
 * cycle already stored. Switching to `'monthly'` doesn't clear a
 * previously-entered annual price (see `setSubscriptionAnnualPrice`)
 * — it's simply ignored while the cycle is monthly, so switching back
 * to annual later restores it. */
export async function setSubscriptionBillingCycle(
  source: string,
  cycle: SubscriptionBillingCycle,
): Promise<void> {
  const current = await getSetting<Record<string, SubscriptionBillingCycle>>(
    'subscriptionBillingCycle',
    {},
  );
  await setSetting('subscriptionBillingCycle', { ...current, [source]: cycle });
}

/** Persists the actual annual price `source` is billed, or clears it
 * when `price` is `null`. Purely a stored value — switching the
 * billing cycle to `'annual'` (see `setSubscriptionBillingCycle`) is
 * what actually makes it count toward `effectivePrice`. */
export async function setSubscriptionAnnualPrice(
  source: string,
  price: number | null,
): Promise<void> {
  const current = await getSetting<Record<string, number>>(
    'subscriptionAnnualPrices',
    {},
  );
  const next = { ...current };
  if (price === null) {
    delete next[source];
  } else {
    next[source] = price;
  }
  await setSetting('subscriptionAnnualPrices', next);
}
