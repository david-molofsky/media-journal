import type { MediaEntry, NewMediaEntryInput } from '@/models';

export function completedEntryInput(
  overrides: Partial<NewMediaEntryInput> = {},
): NewMediaEntryInput {
  return {
    title: 'Test entry',
    mediaType: 'film',
    status: 'completed',
    completedDate: '2026-09-15',
    rating: 8,
    repeatConsumption: false,
    tags: [],
    genres: [],
    watchedWith: [],
    recommendedBy: [],
    metadata: {},
    ...overrides,
  };
}

export function storedEntry(overrides: Partial<MediaEntry> = {}): MediaEntry {
  return {
    ...completedEntryInput(),
    id: 'entry-1',
    completedYear: 2026,
    createdAt: '2026-09-15T09:00:00.000Z',
    updatedAt: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}
