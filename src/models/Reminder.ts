export interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  entryId?: string;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string;
  /** Until this time, keep the snoozed reminder off the dashboard. */
  snoozedUntil?: string;
  dismissedAt?: string;
}
