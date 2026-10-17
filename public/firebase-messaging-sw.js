/* Firebase Messaging is imported into the existing Workbox service worker.
 * Do not register this file as a separate service worker: that would replace
 * the PWA worker at the same scope. These Firebase web config values are public
 * identifiers, not server credentials.
 */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAfXli-VenoDHGtsFdXH3yYfIBJITYnwSI',
  authDomain: 'media-journal-c6d2e.firebaseapp.com',
  projectId: 'media-journal-c6d2e',
  storageBucket: 'media-journal-c6d2e.firebasestorage.app',
  messagingSenderId: '707853840860',
  appId: '1:707853840860:web:590678b367b27d9b25df19',
});

// Importing the compat messaging SDK installs its background push handler.
// Notification payloads sent from Firebase Console are displayed by the SDK.
firebase.messaging();
