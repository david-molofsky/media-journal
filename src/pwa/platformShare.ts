import type { MediaType, NewMediaEntryInput } from '@/models';

export interface PlatformShare {
  title: string;
  text: string;
  url: string;
}

export function readPlatformShare(search = window.location.search): PlatformShare | null {
  const params = new URLSearchParams(search);
  if (params.get('share-target') !== '1') return null;

  const share = {
    title: params.get('title')?.trim() ?? '',
    text: params.get('text')?.trim() ?? '',
    url: params.get('url')?.trim() ?? '',
  };

  return share.title || share.text || share.url ? share : null;
}

export function platformShareValues(
  share: PlatformShare,
  mediaType: MediaType,
): NewMediaEntryInput {
  const notes = [share.text, share.url].filter(Boolean).join('\n\n');

  return {
    title: share.title || share.text || share.url,
    mediaType: mediaType.id,
    status: 'wishlist',
    startedDate: undefined,
    completedDate: undefined,
    rating: undefined,
    notes,
    repeatConsumption: false,
    tags: [],
    genres: [],
    watchedWith: [],
    recommendedBy: [],
    metadata: Object.fromEntries(mediaType.fields.map((field) => [field.key, undefined])),
  };
}

export function clearPlatformShareFromAddressBar(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('share-target');
  url.searchParams.delete('title');
  url.searchParams.delete('text');
  url.searchParams.delete('url');
  window.history.replaceState(window.history.state, '', url);
}
