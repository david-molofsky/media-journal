import dayjs, { type Dayjs } from 'dayjs';
import type { MediaEntry } from '@/models';

/**
 * One bar (or marker) on the Timeline page. A "marker" is a
 * zero-duration entry — no `startedDate` was recorded, so all we know
 * is the day it was completed (or, for an in-progress entry, today).
 * See TimelinePage.tsx for how these render differently from a dated
 * span.
 */
export interface TimelineBar {
  entryId: string;
  title: string;
  mediaType: string;
  start: Dayjs;
  end: Dayjs;
  isMarker: boolean;
  /** Still ongoing — `end` is today rather than a real completedDate,
   * so TimelineChart draws an open/fading edge instead of a solid one
   * (see chat). Status changes to in_progress auto-fill startedDate
   * with today (EntryForm's toggle, updateEntryStatus), so this should
   * be rare in practice; a still-undated in_progress entry (from
   * before that fix, or restored from an old backup) falls back to a
   * marker at today rather than being dropped from the chart. */
  isInProgress: boolean;
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
  entries: Pick<MediaEntry, 'id' | 'title' | 'mediaType' | 'status' | 'startedDate' | 'completedDate'>[],
): TimelineBar[] {
  const today = dayjs().startOf('day');

  const bars: Omit<TimelineBar, 'row'>[] = entries
    .filter((e) => !!e.completedDate || e.status === 'in_progress')
    .map((e) => {
      const isInProgress = e.status === 'in_progress';
      const end = isInProgress ? today : dayjs(e.completedDate);
      const isMarker = !e.startedDate;
      const start = isMarker ? end : dayjs(e.startedDate);
      return { entryId: e.id, title: e.title, mediaType: e.mediaType, start, end, isMarker, isInProgress };
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
