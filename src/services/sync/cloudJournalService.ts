import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import type { ExportPayload } from '@/services/importExport/importExportService';
import { getFirebaseServices } from './firebaseClient';

const BATCH_WRITE_LIMIT = 400;

export interface CloudJournalManifest {
  schemaVersion: 1;
  status: 'uploading' | 'ready';
  sourceDeviceId: string;
  snapshotExportedAt: string;
  completedAt?: string;
  counts: {
    entries: number;
    mediaTypes: number;
    podcastSubscriptions: number;
    settings: number;
  };
}

interface PendingWrite {
  ref: DocumentReference;
  value: Record<string, unknown>;
}

function firestoreSafe(value: unknown): unknown {
  const serialised = JSON.stringify(value);
  return serialised === undefined ? null : JSON.parse(serialised);
}

function manifestReference(userId: string): DocumentReference {
  const { firestore } = getFirebaseServices();
  return doc(firestore, 'users', userId, 'syncState', 'journal');
}

export async function getCloudJournalManifest(
  userId: string,
): Promise<CloudJournalManifest | null> {
  const snapshot = await getDoc(manifestReference(userId));
  return snapshot.exists() ? (snapshot.data() as CloudJournalManifest) : null;
}

async function commitInChunks(writes: PendingWrite[]): Promise<void> {
  const { firestore } = getFirebaseServices();
  for (let index = 0; index < writes.length; index += BATCH_WRITE_LIMIT) {
    const batch = writeBatch(firestore);
    for (const write of writes.slice(index, index + BATCH_WRITE_LIMIT)) {
      batch.set(write.ref, write.value);
    }
    await batch.commit();
  }
}

/**
 * Uploads the first authoritative cloud snapshot. It never replaces a ready
 * cloud journal. An interrupted upload can only be resumed by the device that
 * started it, preventing a second device from silently becoming the master.
 */
export async function uploadStartingJournal(
  userId: string,
  deviceId: string,
  snapshot: ExportPayload,
): Promise<CloudJournalManifest> {
  const { firestore } = getFirebaseServices();
  const counts = {
    entries: snapshot.entries.length,
    mediaTypes: snapshot.mediaTypes.length,
    podcastSubscriptions: snapshot.podcastSubscriptions.length,
    settings: Object.keys(snapshot.settings).length,
  };
  const uploadingManifest: CloudJournalManifest = {
    schemaVersion: 1,
    status: 'uploading',
    sourceDeviceId: deviceId,
    snapshotExportedAt: snapshot.exportedAt,
    counts,
  };

  // Reserve the empty cloud journal transactionally. Without this, two devices
  // could both observe an empty account and race to become the starting copy.
  await runTransaction(firestore, async (transaction) => {
    const ref = manifestReference(userId);
    const currentSnapshot = await transaction.get(ref);
    const current = currentSnapshot.exists()
      ? (currentSnapshot.data() as CloudJournalManifest)
      : null;

    if (current?.status === 'ready') {
      throw new Error(
        'This account already has a synced journal. Download and merge it instead of replacing it.',
      );
    }
    if (current?.status === 'uploading' && current.sourceDeviceId !== deviceId) {
      throw new Error(
        'Another device has already started creating this cloud journal. Finish setup on that device first.',
      );
    }

    transaction.set(ref, uploadingManifest);
  });

  const writes: PendingWrite[] = [
    ...snapshot.entries.map((entry) => ({
      ref: doc(collection(firestore, 'users', userId, 'entries'), entry.id),
      value: firestoreSafe(entry) as Record<string, unknown>,
    })),
    ...snapshot.mediaTypes.map((mediaType) => ({
      ref: doc(collection(firestore, 'users', userId, 'mediaTypes'), mediaType.id),
      value: firestoreSafe(mediaType) as Record<string, unknown>,
    })),
    ...snapshot.podcastSubscriptions.map((subscription) => ({
      ref: doc(
        collection(firestore, 'users', userId, 'podcastSubscriptions'),
        subscription.id,
      ),
      value: firestoreSafe(subscription) as Record<string, unknown>,
    })),
    ...Object.entries(snapshot.settings).map(([key, value]) => ({
      ref: doc(collection(firestore, 'users', userId, 'settings'), key),
      value: { value: firestoreSafe(value) },
    })),
  ];

  await commitInChunks(writes);

  const readyManifest: CloudJournalManifest = {
    ...uploadingManifest,
    status: 'ready',
    completedAt: new Date().toISOString(),
  };
  const finishBatch = writeBatch(firestore);
  finishBatch.set(manifestReference(userId), {
    ...readyManifest,
    serverCompletedAt: serverTimestamp(),
  });
  await finishBatch.commit();
  return readyManifest;
}
