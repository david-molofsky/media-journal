import { useLiveQuery } from 'dexie-react-hooks';
import {
  getRollingMonthlyBreakdown,
  type RollingMonthDatum,
  type StatsFilters,
} from '@/services/statistics/statisticsService';

/** Trailing-12-months monthly activity, shared by the Dashboard and
 * the Statistics page's Monthly tab (see chat, Sept 2026) — always
 * "now minus 11 months through now", independent of any year selector
 * either page has for its other stats. `filters` is optional so the
 * Dashboard (which doesn't filter this chart at all) and Statistics
 * (which does, via its filter bar) can share the same hook. */
export function useRollingMonthlyBreakdown(filters?: StatsFilters): RollingMonthDatum[] | undefined {
  return useLiveQuery(() => getRollingMonthlyBreakdown(filters), [JSON.stringify(filters ?? {})]);
}
