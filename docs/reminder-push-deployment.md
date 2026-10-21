# Deploying scheduled reminder notifications

This feature mirrors reminder titles and due times to Firestore and sends FCM notifications from a scheduled Cloud Function. Each browser/TWA installation uses a separate Firebase **anonymous-auth** identity, independent of Google sign-in used for journal sync. The FCM token is stored only beneath that installation's identity.

## One-time Firebase Console setup

1. Open Firebase Console for project `media-journal-c6d2e`.
2. In **Authentication → Sign-in method**, enable **Anonymous** sign-in. This is used only to isolate push schedules per installation; it does not ask the user to create an account.
3. Confirm Firebase Cloud Messaging is enabled for the project.
4. Link the project to the **Blaze** billing plan before deploying Cloud Functions. Scheduled functions use Cloud Scheduler and require billing to be enabled. Review the Firebase and Google Cloud billing dashboards and set a budget alert before deployment.

## Deploy

Use a current Firebase CLI logged into an account with permission to deploy Functions and Firestore rules/indexes:

```sh
firebase deploy --project media-journal-c6d2e --only firestore:rules,firestore:indexes,functions
```

The repository's existing Firestore rules require an authenticated user to access their own `users/{uid}/...` subtree. The reminder identity signs in anonymously, so its reminder and device documents remain scoped to that anonymous UID. Do not loosen these rules to public access.

## Behaviour and limitations

- The scheduled function checks for due reminders every minute, so delivery is typically close to the scheduled time, not guaranteed to the exact second.
- FCM delivery requires network connectivity. A device that is offline may receive a notification late after reconnecting.
- Local IndexedDB remains the app's source of truth. Cloud mirroring is best-effort; a failed network write does not prevent a reminder from being saved locally.
- Reminder titles and due times are stored in Firestore so the server can schedule delivery. The linked journal entry and wider journal are not uploaded by this feature.
- Each installation has a separate anonymous identity and token, so notifications are not intentionally broadcast to other devices signed into the same Google sync account.
- If an anonymous identity is cleared from browser storage, the existing server-side reminder records may become orphaned. This initial implementation does not yet provide automatic orphan cleanup.
- Scheduled function delivery is at-least-once in rare failure windows; the function marks a reminder sent after FCM accepts it. FCM acceptance is not proof that the OS displayed the notification.
