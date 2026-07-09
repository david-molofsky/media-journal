import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import type { MediaType } from '@/models';

interface TimelineTypeFilterProps {
  mediaTypes: MediaType[];
  excludedTypeIds: Set<string>;
  onToggle: (mediaTypeId: string) => void;
  onSolo: (mediaTypeId: string) => void;
}

/**
 * The Timeline legend, doubling as a filter: tap a type to hide/show
 * it (re-packing the chart tighter around whatever remains), double-tap
 * to solo it — see chat. Excluded types render outlined/dim rather than
 * disappearing entirely, so it's clear at a glance what's turned off
 * and available to switch back on.
 */
export function TimelineTypeFilter({
  mediaTypes,
  excludedTypeIds,
  onToggle,
  onSolo,
}: TimelineTypeFilterProps) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {mediaTypes.map((mt) => {
        const active = !excludedTypeIds.has(mt.id);
        return (
          <Chip
            key={mt.id}
            size="small"
            variant={active ? 'filled' : 'outlined'}
            onClick={() => onToggle(mt.id)}
            onDoubleClick={() => onSolo(mt.id)}
            icon={
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: active ? mt.colour : 'transparent',
                  border: active ? 'none' : '1.5px solid',
                  borderColor: 'text.disabled',
                  ml: '8px',
                }}
              />
            }
            label={mt.displayName}
            sx={{
              bgcolor: active ? `${mt.colour}26` : 'transparent',
              borderColor: active ? mt.colour : 'divider',
              color: active ? 'text.primary' : 'text.disabled',
              '& .MuiChip-icon': { ml: 0 },
            }}
          />
        );
      })}
    </Stack>
  );
}
