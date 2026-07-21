import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Badge from '@mui/material/Badge';
import TuneIcon from '@mui/icons-material/Tune';
import type { MediaType } from '@/models';
import type { StatsFilters } from '@/hooks/useStatisticsData';

interface StatsFilterBarProps {
  filters: StatsFilters;
  onChange: (filters: StatsFilters) => void;
  mediaTypes: MediaType[];
  availableGenres: string[];
  availableTags: string[];
}

function activeFilterChips(filters: StatsFilters, mediaTypeById: Map<string, MediaType>): string[] {
  const chips: string[] = [];
  for (const id of filters.mediaTypeIds ?? []) {
    chips.push(mediaTypeById.get(id)?.displayName ?? id);
  }
  if (filters.genre) chips.push(filters.genre);
  if (filters.tag) chips.push(filters.tag);
  if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) {
    chips.push(`★ ${filters.ratingMin ?? 0}–${filters.ratingMax ?? 10}`);
  }
  return chips;
}

function activeFilterCount(filters: StatsFilters): number {
  let count = 0;
  if (filters.mediaTypeIds && filters.mediaTypeIds.length > 0) count += 1;
  if (filters.genre) count += 1;
  if (filters.tag) count += 1;
  if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) count += 1;
  return count;
}

/**
 * Statistics page filter bar (Media Type, Genre, Tags, Rating range) —
 * sits below the Year selector and applies to every chart/section on
 * the page except the Wishlist breakdowns, which stay all-time
 * regardless (see StatsFilters' doc comment in statisticsService.ts).
 * Tapping the bar opens a filter sheet; the bar itself just shows a
 * summary chip row + active-filter count.
 */
export function StatsFilterBar({
  filters,
  onChange,
  mediaTypes,
  availableGenres,
  availableTags,
}: StatsFilterBarProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StatsFilters>(filters);

  const mediaTypeById = new Map(mediaTypes.map((t) => [t.id, t]));
  const chips = activeFilterChips(filters, mediaTypeById);
  const count = activeFilterCount(filters);

  const openSheet = () => {
    setDraft(filters);
    setOpen(true);
  };

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const clearAll = () => {
    setDraft({});
  };

  const toggleMediaType = (id: string) => {
    setDraft((prev) => {
      const current = new Set(prev.mediaTypeIds ?? []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, mediaTypeIds: current.size > 0 ? Array.from(current) : undefined };
    });
  };

  return (
    <>
      <Box
        onClick={openSheet}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'action.hover',
          borderRadius: 5,
          px: 1.5,
          py: 1,
          mb: 3,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <TuneIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
        <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', flex: 1 }}>
          {chips.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Filter statistics
            </Typography>
          ) : (
            chips.map((chip) => (
              <Chip key={chip} label={chip} size="small" color="primary" variant="outlined" />
            ))
          )}
        </Stack>
        {count > 0 && (
          <Badge badgeContent={count} color="primary" sx={{ flexShrink: 0, mr: 0.5 }} />
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Filter Statistics</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Media Type
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {mediaTypes.map((type) => (
                  <Chip
                    key={type.id}
                    label={type.displayName}
                    size="small"
                    onClick={() => toggleMediaType(type.id)}
                    color={(draft.mediaTypeIds ?? []).includes(type.id) ? 'primary' : 'default'}
                    variant={(draft.mediaTypeIds ?? []).includes(type.id) ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Box>

            <Autocomplete
              size="small"
              options={availableGenres}
              value={draft.genre ?? null}
              onChange={(_, value) => setDraft((prev) => ({ ...prev, genre: value ?? undefined }))}
              renderInput={(params) => <TextField {...params} label="Genre" />}
            />

            <Autocomplete
              size="small"
              options={availableTags}
              value={draft.tag ?? null}
              onChange={(_, value) => setDraft((prev) => ({ ...prev, tag: value ?? undefined }))}
              renderInput={(params) => <TextField {...params} label="Tags" />}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Rating
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  type="number"
                  label="Min"
                  slotProps={{ htmlInput: { min: 0, max: 10, step: 0.5 } }}
                  value={draft.ratingMin ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      ratingMin: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  sx={{ flex: 1 }}
                />
                <Typography color="text.secondary">–</Typography>
                <TextField
                  size="small"
                  type="number"
                  label="Max"
                  slotProps={{ htmlInput: { min: 0, max: 10, step: 0.5 } }}
                  value={draft.ratingMax ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      ratingMax: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  sx={{ flex: 1 }}
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearAll}>Clear all</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={apply}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
