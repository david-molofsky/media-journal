export interface StorageHealth {
  persisted: boolean | null;
  usageRatio: number | null;
}

export async function checkStorageHealth(): Promise<StorageHealth> {
  if (!navigator.storage) return { persisted: null, usageRatio: null };

  const [persisted, estimate]: [boolean | null, StorageEstimate] = await Promise.all([
    navigator.storage.persisted?.().catch(() => false) ?? Promise.resolve(null),
    navigator.storage.estimate?.().catch(() => ({}) as StorageEstimate) ??
      Promise.resolve({} as StorageEstimate),
  ]);
  const usageRatio =
    estimate.usage !== undefined && estimate.quota
      ? estimate.usage / estimate.quota
      : null;

  return { persisted, usageRatio };
}

export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.().catch(() => false)) ?? false;
}
