import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import type { MalRowState } from '@/services/importExport/malImportService';

interface MalDateReviewDialogProps {
  rows: MalRowState[];
  onSetCompletedDate: (index: number, date: string) => void;
  onSkip: (index: number) => void;
  onSetIncluded: (index: number, value: boolean) => void;
  onSetAllIncluded: (value: boolean) => void;
  onConfirm: () => void;
}

/**
 * Review step shown on every MAL sync now, not just ones with a
 * missing finish_date — 'ready' rows are individually tickable (the
 * "tick box" feature, see chat), same as every other import source's
 * review screen, rather than only being summarised in one line. Rows
 * needing a date keep the original per-row date field + Skip button
 * (mirrors the StoryGraph import's needs_date card UI); duplicates are
 * summarised in one line since there's nothing to review about them.
 */
export function MalDateReviewDialog({
  rows,
  onSetCompletedDate,
  onSkip,
  onSetIncluded,
  onSetAllIncluded,
  onConfirm,
}: MalDateReviewDialogProps) {
  const needsDateRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'needs_date');
  const readyRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'ready');
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length;
  const resolvedCount = needsDateRows.filter(({ row }) => !!row.completedDate).length;
  const includedReadyCount = readyRows.filter(({ row }) => row.included).length;
  const toImportCount = includedReadyCount + resolvedCount;
  const allReadyIncluded = readyRows.length === 0 || readyRows.every(({ row }) => row.included);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {needsDateRows.length > 0
            ? `${needsDateRows.length} ${needsDateRows.length === 1 ? 'entry needs' : 'entries need'} a completion date. `
            : ''}
          {readyRows.length} {readyRows.length === 1 ? 'entry' : 'entries'} ready to import
          {duplicateCount > 0 ? `, ${duplicateCount} already imported` : ''}.
        </Typography>
        {readyRows.length > 0 && (
          <Button size="small" onClick={() => onSetAllIncluded(!allReadyIncluded)} sx={{ flexShrink: 0 }}>
            {allReadyIncluded ? 'Deselect all' : 'Select all'}
          </Button>
        )}
      </Stack>

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

        {readyRows.map(({ row, index }) => (
          <Stack key={`${row.entry.node.id}-${row.mediaType}`} direction="row" alignItems="center" spacing={1}>
            <Checkbox
              size="small"
              checked={row.included}
              onChange={(e) => onSetIncluded(index, e.target.checked)}
            />
            <Typography variant="body2" sx={{ flex: 1, opacity: row.included ? 1 : 0.5 }}>
              {row.entry.node.title}
            </Typography>
            <Chip label={row.mediaType === 'anime' ? 'Anime' : 'Manga'} size="small" variant="outlined" />
          </Stack>
        ))}
      </Stack>

      <Button variant="contained" onClick={onConfirm} disabled={rows.length === 0}>
        Import {toImportCount} {toImportCount === 1 ? 'entry' : 'entries'}
      </Button>
    </Stack>
  );
}

