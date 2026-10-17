# Device-local push notification spike

## Scope

This spike tests whether Firebase Cloud Messaging (FCM) can deliver a notification to the device that registered for push while Media Journal is closed. It does **not** schedule reminders, upload reminder data, store tokens on a server, or enable push notifications for normal use.

The spike deliberately uses the existing Workbox service worker. A second service worker at the same scope would replace the PWA worker and could break offline support.

## One-time Firebase setup

1. Open Firebase Console for project `media-journal-c6d2e`.
2. Go to **Project settings → Cloud Messaging → Web configuration**.
3. Under **Web Push certificates**, generate a key pair if none exists and copy the **public key**.
4. Add that public key as `VITE_FIREBASE_VAPID_KEY` in the GitHub Pages workflow build environment (or the local `.env` for a local build). It is a public key, not a server credential.
5. Confirm Cloud Messaging is available for the Firebase project.

The public key is intentionally not committed to this spike. Without it, the Enable notifications button reports that configuration is missing.

## Test on one device

1. Deploy this spike to GitHub Pages after its PR is approved and merged.
2. Open Media Journal on the test device. On iPhone, use the Home Screen-installed PWA; browser tabs cannot receive Web Push on iOS.
3. Open **Reminders** and tap **Enable notifications**. Grant permission.
4. Copy the displayed FCM registration token. It identifies this app installation and should be treated as private.
5. In Firebase Console, open **Messaging**, create a test message with a title/body, and use **Send test message** to target that registration token.
6. Close Media Journal completely, then send another test message to the same token. Confirm the operating system displays it.
7. Repeat independently on the other device. Each device should register a different token and receive only messages addressed to its own token.

## Pass criteria

- A token is returned for the device after permission is granted.
- A Firebase Console test notification appears while the app is closed on Android TWA.
- A Firebase Console test notification appears while the Home Screen PWA is closed on a supported iPhone/iOS version.
- Existing offline/PWA behavior remains intact.

## Known limitations and next step

- Actual reminder delivery still needs a trusted server scheduler and a secure per-device token/reminder registration API. The production service must store the token with a device-specific identifier, not broadcast reminders to other devices, and must de-duplicate deliveries.
- Firebase Cloud Functions and Cloud Scheduler deployment require the Firebase project to use the Blaze (pay-as-you-go) plan. Do not deploy backend functions as part of this spike.
- FCM token registration alone is not proof of closed-app delivery; the manual console test is the decisive check.
- To disable the test, revoke notification permission on the device and remove the test token from any console test setup. No server-side subscription is created by this spike.
