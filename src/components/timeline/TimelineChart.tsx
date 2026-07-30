import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { TimelineBar } from '@/utils/timelinePacking';
import {
  TIMELINE_ZOOM_LEVELS,
  DAY_GRIDLINE_THRESHOLD,
  type TimelineZoomLevel,
} from '@/utils/timelineZoom';
import type { MediaType } from '@/models';

interface TimelineChartProps {
  bars: TimelineBar[];
  zoom: TimelineZoomLevel;
  mediaTypes: MediaType[];
  onOpenEntry: (entryId: string) => void;
}

// Row layout: bar/marker sits at the top of the row, its title renders
// directly below in the same row rather than inside/beside the bar —
// this keeps titles legible at any zoom level, including narrow bars
// and single-day markers.
//
// Row height is FIXED — every row reserves exactly one label line's
// worth of space, always, regardless of how many entries land in it or
// whether their labels actually render. Entries that can't fit a label
// without colliding with a neighbour simply don't show one (see the
// collision pass below); they never push the row taller. This is
// deliberate: a dense cluster of same-week entries must never inflate
// one row's height, because that inflation cascades — it pushes every
// row below it further down the page, which is what "the timeline
// needs a finite bottom" turned out to actually be about (see chat).
const TOP_PAD = 10;
const BAR_HEIGHT = 20;
const MARKER_SIZE = 10;
const LABEL_GAP = 8;
const LABEL_LINE_HEIGHT = 14;
const ROW_BOTTOM_PAD = 6;
const ROW_HEIGHT = TOP_PAD + BAR_HEIGHT + LABEL_GAP + LABEL_LINE_HEIGHT + ROW_BOTTOM_PAD;
const MIN_BAR_WIDTH = 6;
const AXIS_HEIGHT = 24;
// Rough average glyph width at the 10px caption size used for bar/label
// text — good enough to decide "does this title fit inside the bar" and
// to estimate label widths for collision avoidance, not a real
// text-measurement API (canvas measureText would be more exact but
// isn't worth the render-thread cost for a threshold check).
const CHAR_WIDTH_ESTIMATE = 5.5;
const INSIDE_LABEL_PADDING = 8;
const IN_PROGRESS_ARROW_SIZE = 14;
// Minimum horizontal gap enforced between two below-bar labels before
// the later one is hidden rather than shown (see chat: stacking a
// second line was the old behaviour and is exactly what inflated row
// height; hiding it and relying on tap/hover-to-reveal is the fix).
const LABEL_COLLISION_GAP = 6;
// Labels (below-bar and inline-fit alike) only render once there's
// genuinely enough horizontal room per day — i.e. Week and Month zoom.
// At Quarter/Year, density is naturally highest, so labels drop out
// entirely in favour of colour + tap/hover-to-reveal (see chat: "mix
// between" fixed height and zoom-based labels). Tied to the continuous
// pixels-per-day value (not the discrete zoom prop) so pinch/wheel zoom
// crosses this threshold smoothly, the same way gridline granularity
// already does via DAY_GRIDLINE_THRESHOLD.
const LABEL_VISIBILITY_PPD_THRESHOLD = TIMELINE_ZOOM_LEVELS.month.pixelsPerDay;
// How long a touch must be held before it's treated as "reveal the
// title" rather than "open the entry" — long enough to not misfire on
// an ordinary tap, short enough to not feel unresponsive.
const LONG_PRESS_MS = 450;
// Visible viewport caps at this many rows before scrolling vertically —
// now a simple safety net for genuinely large numbers of truly
// concurrent entries (row height no longer varies, so this triggers far
// less often than it used to).
const MAX_VISIBLE_ROWS = 6;

/**
 * The horizontally-scrollable Gantt chart itself. Rows come pre-packed
 * from TimelinePage (useTimelineEntries + packTimelineBars, filtered by
 * the type-filter chips) — this component only turns
 * (row, start, end) into pixel positions and handles zoom/scroll.
 *
 * The visible date range always runs from the earliest bar's start
 * (floored to the start of its month) through today, so "today" is a
 * stable right-hand edge regardless of how much history exists — and
 * the view scrolls there by default on mount and on every zoom change,
 * putting the most recent activity in view first (the "last 6 months"
 * default agreed in chat, achieved via scroll position rather than by
 * filtering the data — older entries are still just a scroll away).
 *
 * Zoom has two layers: the Week/Month/Quarter/Year buttons in
 * TimelinePage set a preset pixels-per-day value (the `zoom` prop);
 * on top of that, this component renders at a fixed pixels-per-day
 * value determined entirely by the `zoom` preset — no continuous
 * pinch/wheel zoom (removed per chat: presets only, simpler and more
 * reliable on touchscreens than pinch was).
 */
export function TimelineChart({
  bars,
  zoom,
  mediaTypes,
  onOpenEntry,
}: TimelineChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollToTodayRef = useRef(true);

  // Reveal strip — shows the tapped/clicked/hovered entry's title
  // above the chart, and stays until another entry is tapped/hovered
  // (see chat). A quick tap or single click reveals the name; a
  // long-press (touch) or double-click (mouse) navigates to that
  // entry's edit page instead. This is the reverse of the original
  // mapping (tap navigated, long-press revealed) — swapped per
  // David's call, since a quick tap is the lower-commitment action
  // and should be the lower-commitment result (just showing the
  // name), while the deliberate gesture (long-press/double-click)
  // should be the one that navigates away from the Timeline.
  const [revealedTitle, setRevealedTitle] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const startLongPress = (bar: TimelineBar) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onOpenEntry(bar.entryId);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const handleEntryClick = (bar: TimelineBar) => {
    // A completed long-press already navigated away — swallow the
    // click that follows touchend rather than also revealing.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    setRevealedTitle(bar.title);
  };

  // "Scroll to today" fires on mount and whenever the zoom preset
  // changes (see the totalWidth-keyed effect further below).
  useEffect(() => {
    scrollToTodayRef.current = true;
  }, [zoom]);

  const pixelsPerDay = TIMELINE_ZOOM_LEVELS[zoom].pixelsPerDay;
  const gridline = pixelsPerDay >= DAY_GRIDLINE_THRESHOLD ? 'day' : 'month';

  const today = dayjs().endOf('day');
  const earliestStart = bars.reduce(
    (min, bar) => (bar.start.isBefore(min) ? bar.start : min),
    today,
  );
  const epoch = earliestStart.startOf('month');
  const totalDays = Math.max(today.diff(epoch, 'day') + 1, 1);
  const totalWidth = totalDays * pixelsPerDay;
  const dayOffset = (date: dayjs.Dayjs) =>
    date.startOf('day').diff(epoch, 'day') * pixelsPerDay;

  const colourFor = (mediaTypeId: string) =>
    mediaTypes.find((mt) => mt.id === mediaTypeId)?.colour ?? '#9E9E9E';

  // Per-bar pixel geometry at the current zoom, computed once up front
  // and reused for both the label-collision pass below and rendering —
  // avoids recomputing width/fitsInside twice per bar.
  interface BarGeometry {
    bar: TimelineBar;
    left: number;
    width: number;
    fitsInside: boolean;
    /** Anchor x for a below-bar label (marker center, or bar center) —
     * only meaningful when the label is actually shown (isMarker or
     * !fitsInside). */
    labelAnchorX: number;
    labelWidth: number;
  }
  const geometries: BarGeometry[] = bars.map((bar) => {
    const left = dayOffset(bar.start);
    const labelWidth = bar.title.length * CHAR_WIDTH_ESTIMATE;
    if (bar.isMarker) {
      return { bar, left, width: 0, fitsInside: false, labelAnchorX: left, labelWidth };
    }
    const width = Math.max(bar.end.diff(bar.start, 'day') * pixelsPerDay, MIN_BAR_WIDTH);
    const fitsInside = width >= labelWidth + INSIDE_LABEL_PADDING;
    return { bar, left, width, fitsInside, labelAnchorX: left + width / 2, labelWidth };
  });

  // Label collision avoidance: two bars/markers whose own bar-space
  // doesn't overlap (packTimelineBars already guarantees that within a
  // row) can still have overlapping *labels*, since a label is often
  // wider than what it's attached to — a marker's dot is 10px but its
  // title might be 80px. Rather than stacking the loser onto a second
  // line (the old behaviour, and the source of the row-inflation bug —
  // see chat), the loser's label is hidden outright; its bar/marker
  // still renders and is still tappable to open, or long-press/hover to
  // reveal its title in the strip above the chart. Row height is fixed
  // regardless of how many entries collide in it.
  const rowCount = bars.reduce((max, bar) => Math.max(max, bar.row + 1), 1);
  const labelVisibleByEntry = new Map<string, boolean>();
  for (let row = 0; row < rowCount; row++) {
    const itemsInRow = geometries
      .filter((g) => g.bar.row === row && (g.bar.isMarker || !g.fitsInside))
      .map((g) => ({
        entryId: g.bar.entryId,
        left: g.labelAnchorX - g.labelWidth * 0.35,
        right: g.labelAnchorX - g.labelWidth * 0.35 + g.labelWidth,
      }))
      .sort((a, b) => a.left - b.left);

    let lastRight = -Infinity;
    for (const item of itemsInRow) {
      const fits = item.left >= lastRight + LABEL_COLLISION_GAP;
      labelVisibleByEntry.set(item.entryId, fits);
      if (fits) lastRight = item.right;
    }
  }

  // Labels only render at Week/Month zoom density — see
  // LABEL_VISIBILITY_PPD_THRESHOLD above.
  const labelsAllowedAtZoom = pixelsPerDay >= LABEL_VISIBILITY_PPD_THRESHOLD;

  // Row tops are now a simple fixed progression — no per-row variation
  // to accumulate.
  const rowTops: number[] = Array.from(
    { length: rowCount },
    (_, row) => AXIS_HEIGHT + row * ROW_HEIGHT,
  );
  const chartHeight = rowCount * ROW_HEIGHT;

  // Gridlines: one per day (Week zoom) or one per month-start
  // (everything else). Not virtualized — fine at personal-library
  // scale (a few years of history is at most a few thousand
  // gridlines), but worth revisiting if it ever gets sluggish with a
  // much larger shared library down the line.
  const gridlines: { offset: number; label: string }[] = [];
  if (gridline === 'day') {
    for (
      let d = epoch;
      d.isBefore(today) || d.isSame(today, 'day');
      d = d.add(1, 'day')
    ) {
      gridlines.push({ offset: dayOffset(d), label: d.format('ddd D') });
    }
  } else {
    for (
      let m = epoch;
      m.isBefore(today) || m.isSame(today, 'month');
      m = m.add(1, 'month')
    ) {
      gridlines.push({ offset: dayOffset(m), label: m.format('MMM YYYY') });
    }
  }

  // Scroll to "today" at the right edge on mount and whenever a preset
  // zoom button is picked (flagged above, during the render-time zoom
  // reset). Keyed on totalWidth because scrollWidth only reflects the
  // new zoom once the resulting re-render has landed. The flag keeps
  // pinch/wheel zoom, which also changes totalWidth every step, from
  // fighting the anchor-based scroll adjustment below by jumping back
  // to "today" on every frame.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollToTodayRef.current) return;
    el.scrollLeft = el.scrollWidth;
    scrollToTodayRef.current = false;
  }, [totalWidth]);

  // Cap the visible viewport at MAX_VISIBLE_ROWS worth of fixed-height
  // rows before scrolling vertically kicks in.
  const visibleRowCount = Math.min(MAX_VISIBLE_ROWS, rowCount);
  const maxVisibleHeight =
    visibleRowCount < rowCount
      ? (rowTops[visibleRowCount] ?? chartHeight + AXIS_HEIGHT)
      : chartHeight + AXIS_HEIGHT;

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          minHeight: 20,
          mb: 0.5,
          fontWeight: 500,
          color: revealedTitle ? 'text.primary' : 'text.secondary',
        }}
      >
        {revealedTitle ?? 'Tap or hover an entry to see its title'}
      </Typography>
      <Box
        ref={scrollRef}
        sx={{
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: maxVisibleHeight,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          touchAction: 'pan-x pan-y',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: totalWidth,
            height: chartHeight + AXIS_HEIGHT,
          }}
        >
          {gridlines.map(({ offset, label }) => (
            <Box
              key={offset}
              sx={{ position: 'absolute', left: offset, top: 0, height: '100%' }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: '1px',
                  bgcolor: 'divider',
                }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: 4,
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}

          {geometries.map(({ bar, left, width, fitsInside, labelAnchorX }) => {
            // Row position is now a fixed lookup — no per-entry vertical
            // adjustment, since row height no longer varies.
            const rowTop = (rowTops[bar.row] ?? AXIS_HEIGHT) + TOP_PAD;
            const colour = colourFor(bar.mediaType);
            const showBelowLabel =
              labelsAllowedAtZoom &&
              (bar.isMarker || !fitsInside) &&
              (labelVisibleByEntry.get(bar.entryId) ?? true);
            const showInlineLabel = labelsAllowedAtZoom && fitsInside;

            const pressHandlers = {
              onMouseEnter: () => setRevealedTitle(bar.title),
              onTouchStart: () => startLongPress(bar),
              onTouchEnd: cancelLongPress,
              onTouchMove: cancelLongPress,
              onClick: () => handleEntryClick(bar),
              onDoubleClick: () => onOpenEntry(bar.entryId),
            };

            // Below-label centers on the anchor point (marker center, or
            // bar center) with a slight rightward bias rather than
            // perfect symmetric centering or a left-flush start — reads
            // more naturally under a dot or a bar too narrow for its own
            // title.
            const belowLabel = showBelowLabel && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  position: 'absolute',
                  left: labelAnchorX,
                  top: rowTop + BAR_HEIGHT + LABEL_GAP,
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  transform: 'translateX(-35%)',
                }}
              >
                {bar.title}
              </Typography>
            );

            if (bar.isMarker) {
              return (
                <Box key={bar.entryId}>
                  <ButtonBase
                    {...pressHandlers}
                    aria-label={bar.title}
                    sx={{
                      position: 'absolute',
                      left: left - MARKER_SIZE / 2,
                      top: rowTop + (BAR_HEIGHT - MARKER_SIZE) / 2,
                      width: MARKER_SIZE,
                      height: MARKER_SIZE,
                      borderRadius: '50%',
                      bgcolor: colour,
                    }}
                  />
                  {belowLabel}
                </Box>
              );
            }

            return (
              <Box key={bar.entryId}>
                <ButtonBase
                  {...pressHandlers}
                  aria-label={bar.title}
                  sx={{
                    position: 'absolute',
                    left,
                    top: rowTop,
                    width,
                    height: BAR_HEIGHT,
                    bgcolor: bar.isInProgress ? undefined : colour,
                    background: bar.isInProgress
                      ? `linear-gradient(to right, ${colour} 0%, ${colour} 70%, ${colour}00 100%)`
                      : undefined,
                    borderRadius: bar.isInProgress ? '4px 0 0 4px' : '4px',
                    overflow: 'hidden',
                    px: fitsInside ? 0.5 : 0,
                  }}
                >
                  {showInlineLabel && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#fff',
                        fontSize: 10,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%',
                        textAlign: 'center',
                      }}
                    >
                      {bar.title}
                    </Typography>
                  )}
                </ButtonBase>
                {bar.isInProgress && (
                  <ArrowForwardIcon
                    sx={{
                      position: 'absolute',
                      left: left + width + 2,
                      top: rowTop + (BAR_HEIGHT - IN_PROGRESS_ARROW_SIZE) / 2,
                      fontSize: IN_PROGRESS_ARROW_SIZE,
                      color: colour,
                    }}
                  />
                )}
                {!fitsInside && belowLabel}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
