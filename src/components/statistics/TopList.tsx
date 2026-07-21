import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export interface TopListItem {
  name: string;
  count: number;
  /** Average rating, when applicable (e.g. Sources). Omitted for
   * counts-only lists (e.g. Wishlist breakdowns, which aren't rated). */
  rating?: number;
}

interface TopListProps {
  items: TopListItem[];
  /** How many rows to show before collapsing the rest behind
   * "+N more". Defaults to 5. */
  cap?: number;
  /** Called with the item's name when a row is tapped/clicked — used to
   * drill down into the Library filtered to that value (e.g. Source).
   * Rows render with a pointer cursor and hover state only when this
   * is provided. */
  onSelectItem?: (name: string) => void;
}

/**
 * Ranked name/count(/rating) list, capped at `cap` rows with a
 * "+N more" button that expands to the full list (and collapses back
 * via "Show less"). Used for Source and Genre breakdowns in
 * Statistics — replaces what used to be uncapped, separately-listed
 * count and rating sections.
 */
export function TopList({ items, cap = 5, onSelectItem }: TopListProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, cap);
  const remaining = items.length - cap;

  return (
    <Stack spacing={0.75}>
      {visible.map((item) => (
        <Stack
          key={item.name}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          onClick={onSelectItem ? () => onSelectItem(item.name) : undefined}
          sx={onSelectItem ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : undefined}
        >
          <Typography variant="body2">{item.name}</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" fontWeight={600}>{item.count}</Typography>
            {item.rating !== undefined && (
              <Typography variant="body2" color="warning.main" sx={{ minWidth: 34, textAlign: 'right' }}>
                ★{item.rating.toFixed(1)}
              </Typography>
            )}
          </Stack>
        </Stack>
      ))}
      {remaining > 0 && (
        <Button
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', minWidth: 0, px: 0.5 }}
        >
          {expanded ? 'Show less' : `+ ${remaining} more`}
        </Button>
      )}
    </Stack>
  );
}
