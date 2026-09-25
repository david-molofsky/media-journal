import { describe, expect, it } from 'vitest';
import { previousConsumption } from './repeatDetection';
import type { MediaEntry, NewMediaEntryInput } from '@/models';

const input = (date: string, metadata = {}, mediaType = 'film'): NewMediaEntryInput => ({
  title: 'The Dark Knight', mediaType, status: 'completed', completedDate: date,
  repeatConsumption: false, metadata, tags: [], genres: [], watchedWith: [], recommendedBy: [],
});
const saved = (date: string, metadata = {}, mediaType = 'film'): MediaEntry => ({
  ...input(date, metadata, mediaType), id: date, createdAt: date, updatedAt: date,
});

describe('repeat detection', () => {
  it('requires an earlier, different completion date', () => {
    expect(previousConsumption(input('2026-09-24'), [saved('2026-09-24')])).toBeUndefined();
    expect(previousConsumption(input('2026-09-24'), [saved('2024-03-12')])?.completedDate).toBe('2024-03-12');
    expect(previousConsumption(input('2024-03-12'), [saved('2026-09-24')])).toBeUndefined();
  });
  it('matches the same TV season or comic issue only', () => {
    expect(previousConsumption(input('2026-09-24', { seasonNumber: 2 }, 'tv'),
      [saved('2024-03-12', { seasonNumber: 1 }, 'tv')])).toBeUndefined();
    expect(previousConsumption(input('2026-09-24', { issueStart: 12 }, 'comic'),
      [saved('2024-03-12', { issueStart: 13 }, 'comic')])).toBeUndefined();
  });
});
