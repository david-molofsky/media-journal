/**
 * Preset zoom levels for the Timeline page — quick jumps to a known
 * pixels-per-day value, each also setting the initial gridline
 * granularity. These are starting points, not hard limits: the chart
 * additionally supports continuous pinch (touch) and ctrl+wheel
 * (trackpad) zoom that free-runs between and beyond these values (see
 * MIN/MAX_PIXELS_PER_DAY and TimelineChart's pinch handling). Picking
 * a preset re-anchors the continuous zoom back to that value.
 */
export const TIMELINE_ZOOM_LEVELS = {
  week: { label: 'Week', pixelsPerDay: 60, gridline: 'day' },
  month: { label: 'Month', pixelsPerDay: 16, gridline: 'month' },
  quarter: { label: 'Quarter', pixelsPerDay: 6, gridline: 'month' },
  year: { label: 'Year', pixelsPerDay: 2, gridline: 'month' },
} as const;

export type TimelineZoomLevel = keyof typeof TIMELINE_ZOOM_LEVELS;

export const TIMELINE_ZOOM_ORDER: TimelineZoomLevel[] = ['week', 'month', 'quarter', 'year'];

/** Clamp bounds for continuous pinch/wheel zoom. */
export const MIN_PIXELS_PER_DAY = 1.5;
export const MAX_PIXELS_PER_DAY = 90;

/** Below this, gridlines switch from per-day to per-month labels. */
export const DAY_GRIDLINE_THRESHOLD = 30;
