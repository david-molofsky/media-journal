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
import { getSubscriptionValue } from '@/services/statistics/subscriptionValueService';
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

/** Only Film and TV entries carry a `runtime` (minutes) field today —
 * see defaultMediaTypes.ts. Every other media type simply doesn't
 * contribute to `hoursThisYear`, rather than guessing a runtime for
 * books/comics/podcasts/games. Flagged in the UI per-card rather than
 * silently showing 0, so it reads as "not tracked" not "zero hours
 * watched". See chat, Sept 2026. */
const RUNTIME_MEDIA_TYPE_IDS = ['film', 'tv'];

export interface SubscriptionCostRow {
  source: string;
  /** Weighted Completed-entry count within the rolling 12-month
   * window, across every enabled media type — reuses the exact same
   * Subscription Value formula/weighting as the Statistics page (see
   * chat: "reuse the existing formula for v1"), just aggregated per
   * source rather than per Statistics group. */
  watchedCount: number;
  avgRating: number | null;
  queuedCount: number;
  /** 0–100 blended score, identical formula to Statistics'
   * Subscription Value cards. */
  score: number;
  belowThreshold: boolean;
  /** Weighted hours from Film/TV entries only within the rolling
   * 12-month window — `null` (not `0`) when this source has no
   * Film/TV usage at all in the window, so the UI can distinguish
   * "genuinely nothing watched" from "this source doesn't carry
   * runtime data". */
  hoursThisYear: number | null;
  /** Tier options for this source in the current pricing region, or
   * `undefined` if none exist (self-hosted source, or a hardcoded
   * service not offered in this region). */
  tiers: SubscriptionTier[] | undefined;
  selectedTierId: string | null;
  /** Resolved monthly price: manual override if set, else the
   * selected tier's price, else `null` if neither exists (needs
   * manual entry). */
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
 * usage/value (reusing the existing Subscription Value formula,
 * aggregated across every enabled media type rather than one
 * Statistics group at a time), tier/price resolution for the current
 * pricing region, and the monthly/annual spend + best/worst value
 * summary shown at the top of the page.
 *
 * A flagged source with zero usage in the last 12 months still gets a
 * row — the point is tracking what's being paid for, not just what's
 * being watched, so a subscription sitting unused is exactly the kind
 * of thing this page should surface rather than hide.
 */
export async function getSubscriptionCostSummary(): Promise<SubscriptionCostSummary> {
  const year: StatsYearScope = 'last12';
  const [subsConfig, watchProviderRegion, tierSelections, priceOverrides, mediaTypes, tvMode] =
    await Promise.all([
      getSubscriptionSourceConfig(),
      getSetting<string>('watchProviderRegion', 'GB'),
      getSetting<Record<string, string>>('subscriptionTierSelections', {}),
      getSetting<Record<string, number>>('subscriptionPriceOverrides', {}),
      listEnabledMediaTypes(),
      getTvTrackingMode(),
    ]);

  const region = pricingRegionFor(watchProviderRegion);
  const allMediaTypeIds = mediaTypes.map((mt) => mt.id);

  const [{ rows: valueRows }, hoursBySource] = await Promise.all([
    getSubscriptionValue(allMediaTypeIds, year),
    getHoursBySource(subsConfig, tvMode),
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
      tierSelections[source] ?? (tiers && tiers.length > 0 ? (tiers[0]?.id ?? null) : null);
    const selectedTier = tiers?.find((t) => t.id === selectedTierId);
    const override = priceOverrides[source];
    const effectivePrice =
      typeof override === 'number' ? override : (selectedTier?.monthlyPrice ?? null);

    return {
      source,
      watchedCount: valueRow?.watchedCount ?? 0,
      avgRating: valueRow?.avgRating ?? null,
      queuedCount: valueRow?.queuedCount ?? 0,
      score: valueRow?.score ?? 0,
      belowThreshold: valueRow?.belowThreshold ?? true,
      hoursThisYear: hoursBySource.get(source) ?? null,
      tiers,
      selectedTierId,
      effectivePrice,
      isOverridden: typeof override === 'number',
    };
  });

  const pricedRows = rows.filter((r) => r.effectivePrice !== null);
  const monthlySpend = pricedRows.reduce((sum, r) => sum + (r.effectivePrice ?? 0), 0);
  const annualSpend = monthlySpend * 12;

  const eligibleForValue = rows.filter((r) => !r.belowThreshold && r.effectivePrice !== null);
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
  const current = await getSetting<Record<string, string>>('subscriptionTierSelections', {});
  await setSetting('subscriptionTierSelections', { ...current, [source]: tierId });
}

/** Persists a manual price override for `source`, or clears it when
 * `price` is `null` (reverting to whatever the selected tier
 * resolves to, if any). */
export async function setSubscriptionPriceOverride(
  source: string,
  price: number | null,
): Promise<void> {
  const current = await getSetting<Record<string, number>>('subscriptionPriceOverrides', {});
  const next = { ...current };
  if (price === null) {
    delete next[source];
  } else {
    next[source] = price;
  }
  await setSetting('subscriptionPriceOverrides', next);
}
