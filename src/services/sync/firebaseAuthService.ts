import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseServices } from './firebaseClient';

export type SyncUser = Pick<User, 'uid' | 'displayName' | 'email'>;

export function subscribeToSyncUser(
  listener: (user: SyncUser | null) => void,
): () => void {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, listener);
}

export async function signInToDeviceSyncWithGoogle(): Promise<SyncUser> {
  const { auth } = getFirebaseServices();
  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutOfDeviceSync(): Promise<void> {
  const { auth } = getFirebaseServices();
  await signOut(auth);
}
