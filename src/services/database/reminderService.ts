import { db } from './db';
import type { Reminder } from '@/models/Reminder';

export async function listReminders(): Promise<Reminder[]> {
  return (await db.reminders.toArray()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function saveReminder(input: Pick<Reminder, 'title' | 'dueAt' | 'entryId'>, id?: string): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Enter a reminder title.');
  const dueAt = new Date(input.dueAt);
  if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    throw new Error('Choose a date and time in the future.');
  }
  const now = new Date().toISOString();
  await db.reminders.put({
    id: id ?? crypto.randomUUID(),
    title,
    dueAt: dueAt.toISOString(),
    ...(input.entryId ? { entryId: input.entryId } : {}),
    createdAt: id ? (await db.reminders.get(id))?.createdAt ?? now : now,
    updatedAt: now,
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}

export async function snoozeReminder(id: string): Promise<void> {
  const reminder = await db.reminders.get(id);
  if (!reminder) return;
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.reminders.update(id, { dueAt, updatedAt: new Date().toISOString() });
}

export async function getUpcomingReminders(): Promise<Reminder[]> {
  return (await listReminders()).filter((reminder) => new Date(reminder.dueAt).getTime() > Date.now());
}
