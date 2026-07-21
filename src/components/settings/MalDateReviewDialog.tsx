import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import type { MalRowState } from '@/services/importExport/malImportService';

interface MalDateReviewDialogProps {
  rows: MalRowState[];
  onSetCompletedDate: (index: number, date: string) => void;
  onSkip: (index: number) => void;
  onConfirm: () => void;
}

/**
 * Review step for MAL entries marked 'completed' with no finish_date
 * on MAL's side. Mirrors the StoryGraph import's needs_date card UI
 * (date field + Skip button per row) — the closer match for a flat
 * list of individually-resolvable rows, as opposed to IMDb's
 * per-show season checkboxes which solve a different problem
 * (ambiguous season coverage, not a missing date).
 *
 * Only rows with status 'needs_date' are shown; 'ready' and
 * 'duplicate' rows are summarised in one line rather than listed
 * individually, since there's nothing to review about them.
 */
export function MalDateReviewDialog({ rows, onSetCompletedDate, onSkip, onConfirm }: MalDateReviewDialogProps) {
  const needsDateRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'needs_date');
  const skippedCount = rows.filter((r) => r.status === 'skipped').length;
  const readyCount = rows.filter((r) => r.status === 'ready').length;
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length;
  const resolvedCount = needsDateRows.filter(({ row }) => !!row.completedDate).length;
  const toImportCount = readyCount + resolvedCount;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {needsDateRows.length} {needsDateRows.length === 1 ? 'entry is' : 'entries are'} marked completed on
        MyAnimeList but have no finish date recorded. Add a date or skip each one — {readyCount} other
        {readyCount === 1 ? ' entry' : ' entries'} {readyCount === 1 ? 'is' : 'are'} ready to import as-is
        {duplicateCount > 0 ? `, ${duplicateCount} already imported` : ''}.
      </Typography>

      <Stack spacing={1.5} sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {needsDateRows.map(({ row, index }) => (
          <Box
            key={`${row.entry.node.id}-${row.mediaType}`}
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: row.status === 'skipped' ? 'divider' : 'warning.main',
              borderRadius: 2,
              opacity: row.status === 'skipped' ? 0.5 : 1,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                {row.entry.node.title}
              </Typography>
              <Chip label={row.mediaType === 'anime' ? 'Anime' : 'Manga'} size="small" variant="outlined" />
            </Stack>
            {row.status === 'skipped' ? (
              <Typography variant="caption" color="text.secondary">
                Skipped — won't be imported
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  type="date"
                  size="small"
                  value={row.completedDate ?? ''}
                  onChange={(e) => onSetCompletedDate(index, e.target.value)}
                  sx={{ maxWidth: 170 }}
                  helperText={
                    row.entry.list_status.start_date ? 'Pre-filled from start date' : undefined
                  }
                />
                <Button size="small" onClick={() => onSkip(index)}>
                  Skip
                </Button>
              </Stack>
            )}
          </Box>
        ))}
      </Stack>

      <Button variant="contained" onClick={onConfirm} disabled={toImportCount === 0 && skippedCount === 0}>
        Import {toImportCount} {toImportCount === 1 ? 'entry' : 'entries'}
      </Button>
    </Stack>
  );
}
