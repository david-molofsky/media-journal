import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { useNavigate } from 'react-router-dom';
import { useWishlistRecommendations } from '@/hooks/useWishlistRecommendations';
import { getEntryImageUrl } from '@/utils/entryImage';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { editEntryPath } from '@/routes/paths';
import type { MediaEntry, MediaType } from '@/models';

interface WishlistRecommendationsSectionProps {
  entry: MediaEntry;
  mediaTypes: MediaType[];
}

/**
 * "More From Your Wishlist" — shown on Edit Entry, below the core
 * fields. Suggests entries already on the user's own Wishlist that
 * share a creator, series/franchise, genre, or tag with the entry
 * being viewed (see chat — scoring lives in
 * utils/wishlistRecommendations.ts). Entirely self-hosted: no
 * external API, just the user's own logged data.
 *
 * Renders nothing when there are no scoring matches, so it never
 * shows an empty section on entries with nothing similar on the
 * Wishlist yet.
 */
export function WishlistRecommendationsSection({ entry, mediaTypes }: WishlistRecommendationsSectionProps) {
  const navigate = useNavigate();
  const recommendations = useWishlistRecommendations(entry);

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
        <AutoAwesomeOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" color="text.secondary">
          More From Your Wishlist
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {recommendations.map(({ entry: rec, reason }) => {
          const recType = mediaTypes.find((t) => t.id === rec.mediaType);
          const Icon = getMediaTypeIcon(recType?.icon ?? '');
          const imageUrl = getEntryImageUrl(rec);
          return (
            <ListItemButton
              key={rec.id}
              onClick={() => navigate(editEntryPath(rec.id))}
              sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 44,
                    borderRadius: 1,
                    flexShrink: 0,
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${recType?.colour ?? 'transparent'}`,
                  }}
                >
                  {imageUrl ? (
                    <Box
                      component="img"
                      src={imageUrl}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Icon fontSize="small" sx={{ color: recType?.colour ?? 'action.active' }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {rec.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {reason}
                  </Typography>
                </Box>
              </Stack>
            </ListItemButton>
          );
        })}
      </Stack>
    </Box>
  );
}
