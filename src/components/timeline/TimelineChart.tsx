import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import type { TimelineBar } from '@/utils/timelinePacking';
import { TIMELINE_ZOOM_LEVELS, type TimelineZoomLevel } from '@/utils/timelineZoom';
import type { MediaType } from '@/models';

interface TimelineChartProps {
  bars: TimelineBar[];
  zoom: TimelineZoomLevel;
  mediaTypes: MediaType[];
  onOpenEntry: (entryId: string) => void;
}

const ROW_HEIGHT = 30;
const BAR_HEIGHT = 22;
const MARKER_SIZE = 10;
const MIN_BAR_WIDTH = 6;
const AXIS_HEIGHT = 24;

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
 */
export function TimelineChart({ bars, zoom, mediaTypes, onOpenEntry }: TimelineChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pixelsPerDay, gridline } = TIMELINE_ZOOM_LEVELS[zoom];

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

  // Scroll to "today" at the right edge on mount and whenever zoom
  // changes — a plain post-render DOM sync, same category as the
  // existing ensureDatabaseSeeded() effect in App.tsx, not a
  // dialog-triggered async flow.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [zoom, totalWidth]);

  return (
    <Box
      ref={scrollRef}
      sx={{
        overflowX: 'auto',
        overflowY: 'hidden',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
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
          const top = AXIS_HEIGHT + bar.row * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
          const colour = colourFor(bar.mediaType);

          if (bar.isMarker) {
            return (
              <ButtonBase
                key={bar.entryId}
                onClick={() => onOpenEntry(bar.entryId)}
                aria-label={bar.title}
                sx={{
                  position: 'absolute',
                  left: left - MARKER_SIZE / 2,
                  top: top + (BAR_HEIGHT - MARKER_SIZE) / 2,
                  width: MARKER_SIZE,
                  height: MARKER_SIZE,
                  borderRadius: '50%',
                  bgcolor: colour,
                }}
              />
            );
          }

          const width = Math.max(bar.end.diff(bar.start, 'day') * pixelsPerDay, MIN_BAR_WIDTH);

          return (
            <ButtonBase
              key={bar.entryId}
              onClick={() => onOpenEntry(bar.entryId)}
              sx={{
                position: 'absolute',
                left,
                top,
                width,
                height: BAR_HEIGHT,
                bgcolor: colour,
                borderRadius: '4px',
                justifyContent: 'flex-start',
                px: width > 24 ? 0.75 : 0,
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#fff',
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {bar.title}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
