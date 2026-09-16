import { describe, expect, it } from 'vitest';
import { platformShareValues, readPlatformShare } from './platformShare';
import type { MediaType } from '@/models';

const mediaType = {
  id: 'film',
  displayName: 'Film',
  fields: [{ key: 'director', label: 'Director', type: 'text', required: false }],
} as MediaType;

describe('platform share target', () => {
  it('ignores ordinary app launches', () => {
    expect(readPlatformShare('?title=Arrival')).toBeNull();
  });

  it('reads shared values and creates a wishlist draft', () => {
    const share = readPlatformShare(
      '?share-target=1&title=Arrival&text=Recommended&url=https%3A%2F%2Fexample.com',
    );

    expect(share).toEqual({
      title: 'Arrival',
      text: 'Recommended',
      url: 'https://example.com',
    });
    expect(platformShareValues(share!, mediaType)).toMatchObject({
      title: 'Arrival',
      mediaType: 'film',
      status: 'wishlist',
      notes: 'Recommended\n\nhttps://example.com',
      metadata: { director: undefined },
    });
  });
});
