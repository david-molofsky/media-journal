import dayjs from 'dayjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { dismissReminder, getUpcomingReminders, snoozeReminder } from './reminderService';

describe('reminder service', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it('snoozes a future reminder from now and preserves its time of day', async () => {
    const originalDue = dayjs()
      .add(5, 'day')
      .hour(19)
      .minute(15)
      .second(0)
      .millisecond(0);
    await db.reminders.add({
      id: 'future',
      title: 'Future reminder',
      dueAt: originalDue.toISOString(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    });

    await snoozeReminder('future', 1);

    const expectedDue = dayjs()
      .add(1, 'day')
      .hour(originalDue.hour())
      .minute(originalDue.minute())
      .second(0)
      .millisecond(0)
      .toISOString();
    expect((await db.reminders.get('future'))?.dueAt).toBe(expectedDue);
  });

  it('rejects invalid snooze durations without changing the reminder', async () => {
    const originalDue = dayjs().add(5, 'day').toISOString();
    await db.reminders.add({
      id: 'future',
      title: 'Future reminder',
      dueAt: originalDue,
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    });

    await expect(snoozeReminder('future', 0)).rejects.toThrow(
      'Choose a snooze duration between 1 and 365 days.',
    );
    expect((await db.reminders.get('future'))?.dueAt).toBe(originalDue);
  });

  it('keeps dismissed reminders out of upcoming results', async () => {
    const base = {
      title: 'Reminder',
      dueAt: dayjs().add(1, 'day').toISOString(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    };
    await db.reminders.bulkAdd([
      { ...base, id: 'active' },
      {
        ...base,
        id: 'dismissed',
        dismissedAt: dayjs().subtract(1, 'hour').toISOString(),
      },
    ]);

    await dismissReminder('active');

    expect((await getUpcomingReminders()).map(({ id }) => id)).toEqual([]);
    expect((await db.reminders.get('active'))?.dismissedAt).toBeTruthy();
  });
});
