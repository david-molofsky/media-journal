import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import type { Reminder } from '@/models/Reminder';
import { getReminderPushServices } from './firebaseClient';

async function ensureReminderIdentity() {
  const { auth, firestore } = getReminderPushServices();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  return { user, firestore };
}

/** Store the token under this installation's separate anonymous identity. */
export async function registerReminderPushToken(token: string): Promise<void> {
  const { user, firestore } = await ensureReminderIdentity();
  await setDoc(doc(firestore, 'users', user.uid, 'devices', 'reminders'), {
    token,
    updatedAt: Timestamp.now(),
    platform: 'web',
  });
}

/**
 * Mirror a reminder only after this installation has enabled push notifications.
 * The anonymous identity is separate from the optional Google sync identity.
 */
export async function syncReminderToPushBackend(reminder: Reminder): Promise<void> {
  const { auth, firestore } = getReminderPushServices();
  const user = auth.currentUser;
  if (!user) return;

  await setDoc(doc(collection(firestore, 'users', user.uid, 'reminders'), reminder.id), {
    title: reminder.title,
    dueAt: Timestamp.fromDate(new Date(reminder.dueAt)),
    sent: false,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteReminderFromPushBackend(id: string): Promise<void> {
  const { auth, firestore } = getReminderPushServices();
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(firestore, 'users', user.uid, 'reminders', id));
}

/** Sync existing local reminders after push permission/token registration. */
export async function syncPendingRemindersToPushBackend(
  reminders: Reminder[],
): Promise<void> {
  for (const reminder of reminders) {
    await syncReminderToPushBackend(reminder);
  }
}
