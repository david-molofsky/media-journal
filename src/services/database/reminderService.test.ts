import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { dismissReminder, getUpcomingReminders, snoozeReminder } from './reminderService';

describe('reminder service', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    vi.useRealTimers();
    db.close();
    await db.delete();
  });

  it('snoozes a future reminder from now and preserves its time of day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T09:00:00.000Z'));
    await db.reminders.add({
      id: 'future',
      title: 'Future reminder',
      dueAt: '2026-10-30T19:15:00.000Z',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
    });

    await snoozeReminder('future', 1);

    expect((await db.reminders.get('future'))?.dueAt).toBe('2026-10-26T19:15:00.000Z');
  });

  it('rejects invalid snooze durations without changing the reminder', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T09:00:00.000Z'));
    await db.reminders.add({
      id: 'future',
      title: 'Future reminder',
      dueAt: '2026-10-30T19:15:00.000Z',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
    });

    await expect(snoozeReminder('future', 0)).rejects.toThrow(
      'Choose a snooze duration between 1 and 365 days.',
    );
    expect((await db.reminders.get('future'))?.dueAt).toBe('2026-10-30T19:15:00.000Z');
  });

  it('keeps dismissed reminders out of upcoming results', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T09:00:00.000Z'));
    const base = {
      title: 'Reminder',
      dueAt: '2026-10-26T19:15:00.000Z',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
    };
    await db.reminders.bulkAdd([
      { ...base, id: 'active' },
      { ...base, id: 'dismissed', dismissedAt: '2026-10-25T08:00:00.000Z' },
    ]);

    await dismissReminder('active');

    expect((await getUpcomingReminders()).map(({ id }) => id)).toEqual([]);
    expect((await db.reminders.get('active'))?.dismissedAt).toBe(
      '2026-10-25T09:00:00.000Z',
    );
  });
});
