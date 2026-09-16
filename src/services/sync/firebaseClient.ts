import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

export const isFirebaseSyncConfigured = requiredConfig.every(
  (value) => typeof value === 'string' && value.trim().length > 0,
);

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

let services: FirebaseServices | undefined;

/**
 * Lazily initialises Firebase so releases without sync configuration keep
 * behaving exactly as they do today. Undefined values never reach Firebase.
 */
export function getFirebaseServices(): FirebaseServices {
  if (!isFirebaseSyncConfigured) {
    throw new Error('Device sync has not been configured for this release.');
  }

  if (services) return services;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    firestore: initializeFirestore(app, { ignoreUndefinedProperties: true }),
  };
  return services;
}
