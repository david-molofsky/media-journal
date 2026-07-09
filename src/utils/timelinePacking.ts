import dayjs, { type Dayjs } from 'dayjs';
import type { MediaEntry } from '@/models';

/**
 * One bar (or marker) on the Timeline page. A "marker" is a
 * zero-duration entry — no `startedDate` was recorded, so all we know
 * is the day it was completed (see TimelinePage.tsx for how these
 * render differently from a dated span).
 */
export interface TimelineBar {
  entryId: string;
  title: string;
  mediaType: string;
  start: Dayjs;
  end: Dayjs;
  isMarker: boolean;
  row: number;
}

/**
 * Greedy interval-packing into the minimum number of rows: sort by
 * start date, then place each bar in the first row whose last bar
 * ends before this one starts, opening a new row only when every
 * existing row is still occupied. Same algorithm as "minimum meeting
 * rooms" — this is what makes overlapping media naturally spread
 * across rows regardless of media type, while non-overlapping entries
 * of *any* type pack back into a shared row (see the Option A vs
 * Option B comparison in chat — Option A, this one, won).
 *
 * A marker (single day) only blocks its own day — the next bar can
 * start that same row the following day.
 */
export function packTimelineBars(
  entries: Pick<MediaEntry, 'id' | 'title' | 'mediaType' | 'startedDate' | 'completedDate'>[],
): TimelineBar[] {
  const bars: Omit<TimelineBar, 'row'>[] = entries
    .filter((e): e is typeof e & { completedDate: string } => !!e.completedDate)
    .map((e) => {
      const isMarker = !e.startedDate;
      const end = dayjs(e.completedDate);
      const start = isMarker ? end : dayjs(e.startedDate);
      return { entryId: e.id, title: e.title, mediaType: e.mediaType, start, end, isMarker };
    })
    .sort((a, b) => a.start.valueOf() - b.start.valueOf());

  const rowEnds: Dayjs[] = [];
  const packed: TimelineBar[] = [];

  for (const bar of bars) {
    let row = rowEnds.findIndex((end) => end.isBefore(bar.start, 'day'));
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(bar.end);
    } else {
      rowEnds[row] = bar.end;
    }
    packed.push({ ...bar, row });
  }

  return packed;
}
