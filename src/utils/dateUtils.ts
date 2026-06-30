import dayjs from 'dayjs';

/** ISO `yyyy-mm-dd` representation of today, used as the default
 * completed date for new entries (PRD section 5: "Add Entry"). */
export function todayIso(): string {
  return dayjs().format('YYYY-MM-DD');
}

/** Current timestamp as an ISO string, used for `createdAt`/`updatedAt`. */
export function nowIso(): string {
  return dayjs().toISOString();
}

/** Extracts the calendar year from an ISO date string. */
export function yearOf(isoDate: string): number {
  return dayjs(isoDate).year();
}

/** Extracts the calendar month (1–12) from an ISO date string. */
export function monthOf(isoDate: string): number {
  return dayjs(isoDate).month() + 1;
}

/** True if `completedDate` falls before `startedDate`, which is invalid
 * (Database Schema & Data Model, section 7: Validation Rules). */
export function isCompletedBeforeStarted(
  startedDate: string | undefined,
  completedDate: string,
): boolean {
  if (!startedDate) return false;
  return dayjs(completedDate).isBefore(dayjs(startedDate), 'day');
}
