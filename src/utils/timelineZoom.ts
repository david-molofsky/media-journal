/**
 * Preset zoom levels for the Timeline page — quick jumps to a known
 * pixels-per-day value, each also setting the initial gridline
 * granularity.
 */
export const TIMELINE_ZOOM_LEVELS = {
  week: { label: 'Week', pixelsPerDay: 60, gridline: 'day' },
  month: { label: 'Month', pixelsPerDay: 16, gridline: 'month' },
  quarter: { label: 'Quarter', pixelsPerDay: 6, gridline: 'month' },
  year: { label: 'Year', pixelsPerDay: 2, gridline: 'month' },
} as const;

export type TimelineZoomLevel = keyof typeof TIMELINE_ZOOM_LEVELS;

export const TIMELINE_ZOOM_ORDER: TimelineZoomLevel[] = ['week', 'month', 'quarter', 'year'];

/** Below this, gridlines switch from per-day to per-month labels. */
export const DAY_GRIDLINE_THRESHOLD = 30;
