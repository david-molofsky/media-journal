import { useLiveQuery } from 'dexie-react-hooks';
import { listEntries } from '@/services/database/entryService';
import { getWishlistRecommendations, type WishlistRecommendation } from '@/utils/wishlistRecommendations';
import type { MediaEntry } from '@/models';

/**
 * "More From Your Wishlist" data for Edit Entry — recomputes whenever
 * the entry itself changes (title/genres/tags/metadata edits) or the
 * Wishlist changes (add/remove/edit elsewhere). Returns `undefined`
 * while loading, an empty array once loaded if nothing scores above 0.
 */
export function useWishlistRecommendations(
  entry: MediaEntry | undefined,
  limit = 5,
): WishlistRecommendation[] | undefined {
  return useLiveQuery(async () => {
    if (!entry) return [];
    const wishlistEntries = await listEntries({ status: 'wishlist' });
    return getWishlistRecommendations(entry, wishlistEntries, limit);
  }, [entry?.id, entry?.genres, entry?.tags, entry?.metadata, entry?.mediaType, entry?.title, limit]);
}
