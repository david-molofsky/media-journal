/**
 * Discrete zoom levels for the Timeline page. Each controls both how
 * many pixels one day occupies (which drives how far you have to
 * scroll) and what the gridline labels show — Week zooms in enough to
 * label individual days, the rest label months. No continuous
 * pinch/slider zoom by design (see chat) — this needs no new
 * dependency and behaves identically on mobile and desktop.
 */
export const TIMELINE_ZOOM_LEVELS = {
  week: { label: 'Week', pixelsPerDay: 60, gridline: 'day' },
  month: { label: 'Month', pixelsPerDay: 16, gridline: 'month' },
  quarter: { label: 'Quarter', pixelsPerDay: 6, gridline: 'month' },
  year: { label: 'Year', pixelsPerDay: 2, gridline: 'month' },
} as const;

export type TimelineZoomLevel = keyof typeof TIMELINE_ZOOM_LEVELS;

export const TIMELINE_ZOOM_ORDER: TimelineZoomLevel[] = ['week', 'month', 'quarter', 'year'];
