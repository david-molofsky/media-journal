import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { ExternalReviewItem } from '@/services/importExport/externalMediaReview';
import { countIncluded } from '@/services/importExport/externalMediaReview';

interface ExternalImportReviewPanelProps {
  items: ExternalReviewItem[];
  onToggleIncluded: (key: string) => void;
  onSelectCandidate: (key: string, candidateId: string) => void;
  /** Only needed for sources whose items can carry a `typeChoice`
   * (currently just Audiobookshelf's Book/Audiobook picker) — omit
   * for sources where mediaType is never ambiguous. */
  onSelectType?: (key: string, value: string) => void;
  onSetAllIncluded: (value: boolean) => void;
  onConfirm: () => void;
}

function statusChip(item: ExternalReviewItem) {
  if (item.status === 'matched') return <Chip label="Matched" size="small" color="success" variant="outlined" />;
  if (item.status === 'ambiguous') return <Chip label="Pick match" size="small" color="warning" variant="outlined" />;
  if (item.status === 'none') return <Chip label="No match" size="small" variant="outlined" />;
  return null;
}

/**
 * Shared review/tick screen for the ID-first external imports
 * (Jellyfin, Plex, Audiobookshelf) — same tick-box shape as
 * TraktReviewPanel, but generic across sources since none of them
 * need Trakt's three-section movies/shows/watchlist split. Ambiguous
 * items get an inline Select to pick among fuzzy-match candidates;
 * Audiobookshelf items with a Book/Audiobook conflict get an inline
 * toggle instead (see externalMediaReview.ts's `typeChoice`).
 */
export function ExternalImportReviewPanel({
  items,
  onToggleIncluded,
  onSelectCandidate,
  onSelectType,
  onSetAllIncluded,
  onConfirm,
}: ExternalImportReviewPanelProps) {
  const includedCount = countIncluded(items);
  const allIncluded = items.length === 0 || items.every((item) => item.included);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {items.length} item{items.length === 1 ? '' : 's'} ready to review.
        </Typography>
        {items.length > 0 && (
          <Button size="small" onClick={() => onSetAllIncluded(!allIncluded)} sx={{ flexShrink: 0 }}>
            {allIncluded ? 'Deselect all' : 'Select all'}
          </Button>
        )}
      </Stack>

      <Stack spacing={1} sx={{ maxHeight: 380, overflowY: 'auto' }}>
        {items.map((item) => (
          <Box key={item.key}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Checkbox
                size="small"
                checked={item.included}
                onChange={() => onToggleIncluded(item.key)}
                sx={{ mt: -0.5 }}
              />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ opacity: item.included ? 1 : 0.5 }}>
                  {item.title}
                </Typography>
                {item.subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {item.subtitle}
                  </Typography>
                )}
              </Stack>
              {statusChip(item)}
            </Stack>

            {item.status === 'ambiguous' && item.candidates.length > 0 && (
              <Select
                size="small"
                fullWidth
                value={item.selectedCandidateId ?? item.candidates[0]!.id}
                onChange={(e) => onSelectCandidate(item.key, e.target.value)}
                sx={{ mt: 0.5, ml: 4.5, width: 'calc(100% - 36px)' }}
              >
                {item.candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.title}
                    {c.subtitle ? ` — ${c.subtitle}` : ''}
                  </MenuItem>
                ))}
              </Select>
            )}

            {item.typeChoice && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={item.typeChoice.selected}
                onChange={(_, value) => value && onSelectType?.(item.key, value)}
                sx={{ mt: 0.5, ml: 4.5 }}
              >
                {item.typeChoice.options.map((opt) => (
                  <ToggleButton key={opt.value} value={opt.value} sx={{ py: 0.25, fontSize: 12 }}>
                    {opt.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Box>
        ))}
      </Stack>

      <Button variant="contained" disabled={includedCount === 0} onClick={onConfirm}>
        Import {includedCount} item{includedCount === 1 ? '' : 's'}
      </Button>
    </Stack>
  );
}
