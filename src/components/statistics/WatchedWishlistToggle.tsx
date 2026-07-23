import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export type WatchedWishlistView = 'watched' | 'wishlist';

interface WatchedWishlistToggleProps {
  value: WatchedWishlistView;
  onChange: (value: WatchedWishlistView) => void;
}

/**
 * Shared Watched/Wishlist switcher for the Statistics Genres and
 * Sources sections. Replaces what used to be two always-stacked
 * blocks (top-by-count, then wishlist) with a single block that shows
 * one view at a time — see chat (Statistics page redesign).
 */
export function WatchedWishlistToggle({ value, onChange }: WatchedWishlistToggleProps) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: WatchedWishlistView | null) => next !== null && onChange(next)}
      sx={{ mb: 1.5 }}
    >
      <ToggleButton value="watched" sx={{ textTransform: 'none', px: 2 }}>
        Watched
      </ToggleButton>
      <ToggleButton value="wishlist" sx={{ textTransform: 'none', px: 2 }}>
        Wishlist
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
