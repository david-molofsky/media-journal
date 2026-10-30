import dayjs from 'dayjs';
import { db } from './db';
import type { Reminder } from '@/models/Reminder';

export async function listReminders(): Promise<Reminder[]> {
  return (await db.reminders.toArray()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function saveReminder(
  input: Pick<Reminder, 'title' | 'dueAt' | 'entryId'>,
  id?: string,
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Enter a reminder title.');
  const dueAt = new Date(input.dueAt);
  if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    throw new Error('Choose a date and time in the future.');
  }
  const existing = id ? await db.reminders.get(id) : undefined;
  const now = new Date().toISOString();
  await db.reminders.put({
    id: id ?? crypto.randomUUID(),
    title,
    dueAt: dueAt.toISOString(),
    ...(input.entryId ? { entryId: input.entryId } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(existing?.dismissedAt ? { dismissedAt: undefined } : {}),
    snoozedUntil: undefined,
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}

export async function dismissReminder(id: string): Promise<void> {
  const reminder = await db.reminders.get(id);
  if (!reminder) return;
  const now = new Date().toISOString();
  await db.reminders.update(id, { dismissedAt: now, updatedAt: now });
}

export async function snoozeReminder(id: string, days = 1): Promise<void> {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('Choose a snooze duration between 1 and 365 days.');
  }
  const reminder = await db.reminders.get(id);
  if (!reminder) return;
  const originalDue = dayjs(reminder.dueAt);
  // Snooze means defer from now, not add time to a future scheduled date.
  // Keep the reminder's wall-clock time while moving it forward by whole days.
  const dueAt = dayjs()
    .add(days, 'day')
    .hour(originalDue.hour())
    .minute(originalDue.minute())
    .second(0)
    .millisecond(0)
    .toISOString();
  const now = new Date().toISOString();
  await db.reminders.update(id, {
    dueAt,
    updatedAt: now,
    notifiedAt: undefined,
    dismissedAt: undefined,
    snoozedUntil: dueAt,
  });
}

export async function getUpcomingReminders(): Promise<Reminder[]> {
  const now = Date.now();
  const windowEnd = now + 7 * 24 * 60 * 60 * 1000;
  return (await listReminders()).filter((reminder) => {
    const dueAt = new Date(reminder.dueAt).getTime();
    return !reminder.dismissedAt && dueAt >= now && dueAt <= windowEnd;
  });
}
