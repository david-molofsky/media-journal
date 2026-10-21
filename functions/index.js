const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');

initializeApp();

const db = getFirestore();
const BATCH_LIMIT = 200;

/**
 * Poll pending reminders once a minute. Each reminder is stored below the
 * anonymous Firebase Auth identity for the device that created it; its FCM
 * token is stored under that same identity.
 */
exports.sendDueReminders = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'UTC', maxInstances: 1 },
  async () => {
    const now = Timestamp.now();
    const due = await db
      .collectionGroup('reminders')
      .where('sent', '==', false)
      .where('dueAt', '<=', now)
      .limit(BATCH_LIMIT)
      .get();

    for (const snapshot of due.docs) {
      const reminder = snapshot.data();
      const userRef = snapshot.ref.parent.parent;
      if (!userRef || !reminder.title || !reminder.dueAt) {
        logger.warn('Skipping malformed reminder', { path: snapshot.ref.path });
        continue;
      }

      const deviceSnapshot = await userRef.collection('devices').doc('reminders').get();
      const token = deviceSnapshot.data()?.token;
      if (!token) {
        // Leave pending so it can be delivered if this device registers later.
        logger.info('No push token registered for due reminder', {
          path: snapshot.ref.path,
        });
        continue;
      }

      try {
        await getMessaging().send({
          token,
          notification: {
            title: reminder.title,
            body: 'Your Media Journal reminder is due.',
          },
          data: { reminderId: snapshot.id, url: '/media-journal/#/reminders' },
          webpush: {
            fcmOptions: {
              link: 'https://david-molofsky.github.io/media-journal/#/reminders',
            },
          },
        });

        // Re-read before marking sent so an edit/snooze during delivery is not
        // accidentally marked as delivered for the new schedule.
        const latest = await snapshot.ref.get();
        if (
          latest.exists() &&
          latest.data()?.sent === false &&
          latest.data()?.dueAt?.toMillis?.() === reminder.dueAt.toMillis()
        ) {
          await snapshot.ref.update({ sent: true, sentAt: Timestamp.now() });
        }
      } catch (error) {
        const code = error && typeof error === 'object' ? error.code : undefined;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await deviceSnapshot.ref.delete();
        }
        logger.error('Failed to send reminder notification', {
          path: snapshot.ref.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  },
);
