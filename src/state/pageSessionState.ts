import type { EntryStatus } from '@/models';
import type { EntrySortOrder } from '@/services/database/entryService';
import type { TimelineZoomLevel } from '@/utils/timelineZoom';
import type { StatsFilters } from '@/hooks/useStatisticsData';

/**
 * Scroll/filter/sort/tab/search state restoration for Library and
 * Timeline (see chat, Aug 2026). Deliberately a plain module-level
 * variable, not Dexie/localStorage — "session-only" means it survives
 * SPA navigation (React Router unmounting/remounting these pages as
 * the user moves between bottom-nav tabs, or via Android hardware
 * back) but resets on an actual app reload/relaunch, same as e.g.
 * TimelinePage's excludedTypeIds already does per-mount.
 *
 * Each page owns exactly one snapshot, overwritten wholesale on
 * unmount. There's no per-tab/per-filter-combination history — the
 * decision was that a manual filter/sort/tab/search change after
 * returning should reset scroll to the top of the (now different)
 * list rather than fight to preserve a scroll offset that no longer
 * corresponds to anything (see chat) — so keeping a matrix of scroll
 * positions per filter state would be wasted complexity.
 */
export interface LibrarySessionState {
  statusTab: EntryStatus;
  searchText: string;
  year?: string;
  month?: string;
  mediaTypeIds: string[];
  mediaTypeIdsExclude: string[];
  tags: string[];
  tagsExclude: string[];
  genres: string[];
  genresExclude: string[];
  sources: string[];
  sourcesExclude: string[];
  sort: EntrySortOrder;
  viewMode: 'entries' | 'series';
  scrollY: number;
}

export interface TimelineSessionState {
  zoom: TimelineZoomLevel;
  excludedTypeIds: string[];
  scrollLeft: number;
  scrollTop: number;
}

/** Statistics' own session snapshot (added Aug 2026) — same rationale
 * as Library/Timeline above: returning via back-navigation (e.g. after
 * tapping a Person's name through to Library) should land back on the
 * same year/filters/expanded tiles/scroll position, not a blank reset
 * page. `expandedSections` is stored as an array (Set doesn't survive
 * structural comparison/serialization cleanly) and converted back to
 * a Set on restore. */
export interface StatisticsSessionState {
  year: number | null | 'last12';
  filters: StatsFilters;
  expandedSections: string[];
  selectedRole: string | null;
  sourcesView: 'watched' | 'wishlist';
  genresView: 'watched' | 'wishlist';
  sourcesSort: string;
  peopleSort: string;
  scrollY: number;
}

let libraryState: LibrarySessionState | null = null;
let timelineState: TimelineSessionState | null = null;
let statisticsState: StatisticsSessionState | null = null;

export function getLibrarySessionState(): LibrarySessionState | null {
  return libraryState;
}

export function setLibrarySessionState(state: LibrarySessionState): void {
  libraryState = state;
}

export function getTimelineSessionState(): TimelineSessionState | null {
  return timelineState;
}

export function setTimelineSessionState(state: TimelineSessionState): void {
  timelineState = state;
}

export function getStatisticsSessionState(): StatisticsSessionState | null {
  return statisticsState;
}

export function setStatisticsSessionState(state: StatisticsSessionState): void {
  statisticsState = state;
}
