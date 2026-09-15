# Firebase device sync setup

The sync UI remains dormant until all required Firebase environment values are
present. Existing local storage and Google Drive backups continue unchanged
while Firebase is absent.

## Firebase console

1. Create a Firebase project.
2. Add a Web app for Media Journal.
3. Enable Authentication > Google.
4. Add `david-molofsky.github.io` to Authentication > Authorized domains.
5. Create a Cloud Firestore database.
6. Deploy `firestore.rules` before enabling the production configuration.

## GitHub Pages build values

Provide these Vite values to the production build. They are Firebase web-app
identifiers, not server credentials; never add an Admin SDK private key.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

`.env.example` lists the same keys for local development.

## Safe first-device behaviour

- The selected device downloads a point-in-time JSON safety copy first.
- A Firestore transaction reserves an empty cloud journal for that device.
- A ready cloud journal can never be replaced by the first-device upload.
- An interrupted upload can only be resumed by the device that started it.
- Google Drive uses separate OAuth permissions and remains available for backups.

Do not enable the production Firebase values until cloud-to-device review/merge
and continuous two-way sync are implemented and tested.
