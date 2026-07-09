import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import type { TimelineBar } from '@/utils/timelinePacking';
import {
  TIMELINE_ZOOM_LEVELS,
  MIN_PIXELS_PER_DAY,
  MAX_PIXELS_PER_DAY,
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
// and single-day markers, at the cost of a taller row (agreed in chat
// over cramming text inside the bar).
const TOP_PAD = 6;
const BAR_HEIGHT = 20;
const MARKER_SIZE = 10;
const LABEL_GAP = 4;
const ROW_HEIGHT = 48;
const MIN_BAR_WIDTH = 6;
const AXIS_HEIGHT = 24;
// Visible viewport caps at this many rows before scrolling vertically,
// so a single busy stretch of overlapping history (which sets the row
// count for the *entire* chart width) doesn't blow the page out with
// empty space everywhere else. Adjust after checking against real data.
const MAX_VISIBLE_ROWS = 6;

/**
 * The horizontally-scrollable Gantt chart itself. Rows come pre-packed
 * from useTimelineBars/packTimelineBars — this component only turns
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
 * on top of that, this component supports continuous pinch (touch)
 * and ctrl+wheel (trackpad) zoom via internal `ppd` state, free-running
 * between MIN/MAX_PIXELS_PER_DAY. Picking a preset re-anchors `ppd`
 * back to that preset's value.
 */
export function TimelineChart({ bars, zoom, mediaTypes, onOpenEntry }: TimelineChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ppd, setPpd] = useState<number>(TIMELINE_ZOOM_LEVELS[zoom].pixelsPerDay);
  const ppdRef = useRef(ppd);
  const pinchRef = useRef<{ startDist: number; startPpd: number } | null>(null);
  const anchorRef = useRef<{ dayIndex: number; clientX: number } | null>(null);
  const scrollToTodayRef = useRef(true);

  useEffect(() => {
    ppdRef.current = ppd;
  }, [ppd]);

  // A preset button click re-anchors continuous zoom back to that
  // preset. This follows React's "adjusting state when a prop changes"
  // pattern (comparing against a stored previous value during render)
  // rather than an effect, since setState-in-effect is disallowed by
  // the project's React Compiler lint rule.
  const [prevZoom, setPrevZoom] = useState(zoom);
  if (zoom !== prevZoom) {
    setPrevZoom(zoom);
    setPpd(TIMELINE_ZOOM_LEVELS[zoom].pixelsPerDay);
  }
  // Ref writes aren't allowed during render, so the "scroll to today"
  // flag is set from an effect instead, keyed the same way.
  useEffect(() => {
    scrollToTodayRef.current = true;
  }, [zoom]);

  const pixelsPerDay = ppd;
  const gridline = pixelsPerDay >= DAY_GRIDLINE_THRESHOLD ? 'day' : 'month';

  const today = dayjs().endOf('day');
  const earliestStart = bars.reduce(
    (min, bar) => (bar.start.isBefore(min) ? bar.start : min),
    today,
  );
  const epoch = earliestStart.startOf('month');
  const totalDays = Math.max(today.diff(epoch, 'day') + 1, 1);
  const totalWidth = totalDays * pixelsPerDay;
  const rowCount = bars.reduce((max, bar) => Math.max(max, bar.row + 1), 1);
  const chartHeight = rowCount * ROW_HEIGHT;

  const dayOffset = (date: dayjs.Dayjs) => date.startOf('day').diff(epoch, 'day') * pixelsPerDay;

  const colourFor = (mediaTypeId: string) =>
    mediaTypes.find((mt) => mt.id === mediaTypeId)?.colour ?? '#9E9E9E';

  // Gridlines: one per day (Week zoom) or one per month-start
  // (everything else). Not virtualized — fine at personal-library
  // scale (a few years of history is at most a few thousand
  // gridlines), but worth revisiting if it ever gets sluggish with a
  // much larger shared library down the line.
  const gridlines: { offset: number; label: string }[] = [];
  if (gridline === 'day') {
    for (let d = epoch; d.isBefore(today) || d.isSame(today, 'day'); d = d.add(1, 'day')) {
      gridlines.push({ offset: dayOffset(d), label: d.format('ddd D') });
    }
  } else {
    for (let m = epoch; m.isBefore(today) || m.isSame(today, 'month'); m = m.add(1, 'month')) {
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

  // Continuous pinch (touch) and ctrl+wheel (trackpad) zoom, layered on
  // top of the preset buttons. Both compute the date under the
  // finger/cursor before changing ppd, stash it in anchorRef, and the
  // layout effect further below re-applies scrollLeft after the resize
  // so that date stays under the same screen position rather than the
  // view jumping around mid-gesture.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const clamp = (value: number) => Math.min(MAX_PIXELS_PER_DAY, Math.max(MIN_PIXELS_PER_DAY, value));
    const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: distance(e.touches[0], e.touches[1]), startPpd: ppdRef.current };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = distance(e.touches[0], e.touches[1]);
      const ratio = dist / pinchRef.current.startDist;
      const nextPpd = clamp(pinchRef.current.startPpd * ratio);
      const rect = el.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      anchorRef.current = { dayIndex: (el.scrollLeft + midX) / ppdRef.current, clientX: midX };
      setPpd(nextPpd);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const factor = Math.exp(-e.deltaY * 0.01);
      const nextPpd = clamp(ppdRef.current * factor);
      anchorRef.current = { dayIndex: (el.scrollLeft + clientX) / ppdRef.current, clientX };
      setPpd(nextPpd);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor) return;
    el.scrollLeft = anchor.dayIndex * ppd - anchor.clientX;
    anchorRef.current = null;
  }, [ppd]);

  return (
    <Box
      ref={scrollRef}
      sx={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: MAX_VISIBLE_ROWS * ROW_HEIGHT + AXIS_HEIGHT,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        touchAction: 'pan-x pan-y',
      }}
    >
      <Box sx={{ position: 'relative', width: totalWidth, height: chartHeight + AXIS_HEIGHT }}>
        {gridlines.map(({ offset, label }) => (
          <Box key={offset} sx={{ position: 'absolute', left: offset, top: 0, height: '100%' }}>
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
              sx={{ position: 'absolute', top: 2, left: 4, whiteSpace: 'nowrap', fontSize: 10 }}
            >
              {label}
            </Typography>
          </Box>
        ))}

        {bars.map((bar) => {
          const left = dayOffset(bar.start);
          const rowTop = AXIS_HEIGHT + bar.row * ROW_HEIGHT + TOP_PAD;
          const colour = colourFor(bar.mediaType);

          // Title always renders as a label below the bar/marker rather
          // than inside or beside it — legible regardless of how narrow
          // the bar is at the current zoom level (see chat: cramming
          // text inside sub-24px bars made most titles unreadable).
          const label = (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                left,
                top: rowTop + BAR_HEIGHT + LABEL_GAP,
                fontSize: 10,
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {bar.title}
            </Typography>
          );

          if (bar.isMarker) {
            return (
              <Box key={bar.entryId}>
                <ButtonBase
                  onClick={() => onOpenEntry(bar.entryId)}
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
                {label}
              </Box>
            );
          }

          const width = Math.max(bar.end.diff(bar.start, 'day') * pixelsPerDay, MIN_BAR_WIDTH);

          return (
            <Box key={bar.entryId}>
              <ButtonBase
                onClick={() => onOpenEntry(bar.entryId)}
                aria-label={bar.title}
                sx={{
                  position: 'absolute',
                  left,
                  top: rowTop,
                  width,
                  height: BAR_HEIGHT,
                  bgcolor: colour,
                  borderRadius: '4px',
                }}
              />
              {label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
