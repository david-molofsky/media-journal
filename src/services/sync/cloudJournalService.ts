import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import type { ExportPayload } from '@/services/importExport/importExportService';
import { getFirebaseServices } from './firebaseClient';
import { calculateJournalHash } from './journalSync';

const BATCH_WRITE_LIMIT = 400;

export interface CloudJournalManifest {
  schemaVersion: 1;
  status: 'uploading' | 'syncing' | 'ready';
  sourceDeviceId: string;
  snapshotExportedAt: string;
  completedAt?: string;
  revision: number;
  journalHash: string;
  baseRevision?: number;
  counts: {
    entries: number;
    mediaTypes: number;
    podcastSubscriptions: number;
    settings: number;
  };
}

interface PendingWrite {
  ref: DocumentReference;
  value?: Record<string, unknown>;
  delete?: boolean;
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
      if (write.delete) batch.delete(write.ref);
      else batch.set(write.ref, write.value ?? {});
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
  const journalHash = await calculateJournalHash(snapshot);
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
    revision: 1,
    journalHash,
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
    if (current?.status === 'syncing') {
      throw new Error(
        'This cloud journal is already being synchronized by an enrolled device.',
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

async function readCollection<T>(userId: string, name: string): Promise<T[]> {
  const { firestore } = getFirebaseServices();
  const snapshot = await getDocs(collection(firestore, 'users', userId, name));
  return snapshot.docs.map((item) => item.data() as T);
}

export async function downloadCloudJournal(
  userId: string,
): Promise<{ manifest: CloudJournalManifest; snapshot: ExportPayload }> {
  const manifest = await getCloudJournalManifest(userId);
  if (!manifest || manifest.status !== 'ready') {
    throw new Error('The cloud journal is not ready to download.');
  }

  const [entries, mediaTypes, podcastSubscriptions] = await Promise.all([
    readCollection<ExportPayload['entries'][number]>(userId, 'entries'),
    readCollection<ExportPayload['mediaTypes'][number]>(userId, 'mediaTypes'),
    readCollection<ExportPayload['podcastSubscriptions'][number]>(
      userId,
      'podcastSubscriptions',
    ),
  ]);

  const { firestore } = getFirebaseServices();
  const settingsSnapshot = await getDocs(
    collection(firestore, 'users', userId, 'settings'),
  );
  const settings = Object.fromEntries(
    settingsSnapshot.docs.map((item) => [item.id, item.data().value]),
  );
  return {
    manifest,
    snapshot: {
      version: 2,
      exportedAt: manifest.completedAt ?? manifest.snapshotExportedAt,
      entries,
      mediaTypes,
      podcastSubscriptions,
      settings,
    },
  };
}

async function snapshotWrites(
  userId: string,
  snapshot: ExportPayload,
): Promise<PendingWrite[]> {
  const { firestore } = getFirebaseServices();
  const groups = [
    {
      name: 'entries',
      values: snapshot.entries.map((value) => ({ id: value.id, value })),
    },
    {
      name: 'mediaTypes',
      values: snapshot.mediaTypes.map((value) => ({ id: value.id, value })),
    },
    {
      name: 'podcastSubscriptions',
      values: snapshot.podcastSubscriptions.map((value) => ({ id: value.id, value })),
    },
    {
      name: 'settings',
      values: Object.entries(snapshot.settings).map(([id, value]) => ({
        id,
        value: { value },
      })),
    },
  ];
  const writes: PendingWrite[] = [];

  for (const group of groups) {
    const targetIds = new Set(group.values.map(({ id }) => id));
    const current = await getDocs(collection(firestore, 'users', userId, group.name));
    for (const item of current.docs) {
      if (!targetIds.has(item.id)) writes.push({ ref: item.ref, delete: true });
    }
    for (const item of group.values) {
      writes.push({
        ref: doc(collection(firestore, 'users', userId, group.name), item.id),
        value: firestoreSafe(item.value) as Record<string, unknown>,
      });
    }
  }
  return writes;
}

/** Replaces an enrolled cloud journal only when its expected revision still matches. */
export async function replaceCloudJournal(
  userId: string,
  deviceId: string,
  snapshot: ExportPayload,
  expectedRevision: number,
): Promise<CloudJournalManifest> {
  const { firestore } = getFirebaseServices();
  const journalHash = await calculateJournalHash(snapshot);
  const ref = manifestReference(userId);

  await runTransaction(firestore, async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    if (!currentSnapshot.exists()) throw new Error('The cloud journal is missing.');
    const current = currentSnapshot.data() as CloudJournalManifest;
    const resuming =
      current.status === 'syncing' &&
      current.sourceDeviceId === deviceId &&
      current.baseRevision === expectedRevision;
    if (
      !resuming &&
      (current.status !== 'ready' || current.revision !== expectedRevision)
    ) {
      throw new Error(
        'The cloud journal changed on another device. Sync again to merge it.',
      );
    }
    transaction.set(ref, {
      ...current,
      status: 'syncing',
      sourceDeviceId: deviceId,
      baseRevision: expectedRevision,
      snapshotExportedAt: snapshot.exportedAt,
    });
  });

  await commitInChunks(await snapshotWrites(userId, snapshot));

  const manifest: CloudJournalManifest = {
    schemaVersion: 1,
    status: 'ready',
    sourceDeviceId: deviceId,
    snapshotExportedAt: snapshot.exportedAt,
    completedAt: new Date().toISOString(),
    revision: expectedRevision + 1,
    journalHash,
    counts: {
      entries: snapshot.entries.length,
      mediaTypes: snapshot.mediaTypes.length,
      podcastSubscriptions: snapshot.podcastSubscriptions.length,
      settings: Object.keys(snapshot.settings).length,
    },
  };
  await runTransaction(firestore, async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    const current = currentSnapshot.data() as CloudJournalManifest | undefined;
    if (
      current?.status !== 'syncing' ||
      current.sourceDeviceId !== deviceId ||
      current.baseRevision !== expectedRevision
    ) {
      throw new Error('The cloud journal changed before synchronization completed.');
    }
    transaction.set(ref, { ...manifest, serverCompletedAt: serverTimestamp() });
  });
  return manifest;
}
