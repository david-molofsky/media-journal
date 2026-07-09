import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import type { GoodreadsRowState } from '@/services/importExport/goodreadsImportService';
import type { GoodreadsImportPhase } from '@/hooks/useGoodreadsImportFlow';

interface GoodreadsImportDialogProps {
  open: boolean;
  phase: GoodreadsImportPhase;
  rows: GoodreadsRowState[];
  progress: { done: number; total: number };
  summary: { imported: number; skipped: number };
  onSetCompletedDate: (index: number, date: string) => void;
  onSkip: (index: number) => void;
  onApply: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'read',
  in_progress: 'in progress',
  wishlist: 'wishlist',
};

/**
 * "Import from Goodreads" dialog.
 *
 *   review    — ready rows shown locked-in; needs_date rows (a
 *               completed book with no Date Read logged — a common
 *               quirk of Goodreads' export) get a date field and a
 *               skip option; duplicates shown dimmed.
 *   importing — sequential per-row entry-creation progress.
 *   done      — short summary.
 *   empty     — the file had no readable, recognizably-shelved rows.
 */
export function GoodreadsImportDialog({
  open,
  phase,
  rows,
  progress,
  summary,
  onSetCompletedDate,
  onSkip,
  onApply,
  onClose,
}: GoodreadsImportDialogProps) {
  const readyCount = rows.filter((r) => r.status === 'ready').length;
  const needsDateCount = rows.filter((r) => r.status === 'needs_date').length;
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length;
  const toImportCount = rows.filter(
    (r) => r.status === 'ready' || (r.status === 'needs_date' && r.completedDate),
  ).length;

  return (
    <Dialog open={open} onClose={phase === 'importing' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import from Goodreads</DialogTitle>
      <DialogContent>
        {phase === 'empty' && (
          <Alert severity="info" variant="outlined">
            No readable rows found. Make sure this is Goodreads' library export CSV, with at
            least a Title and an Exclusive Shelf column.
          </Alert>
        )}

        {phase === 'review' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {readyCount} ready to import. {needsDateCount} need a date.
              {duplicateCount > 0 ? ` ${duplicateCount} already in your library.` : ''}
            </Typography>

            {rows.map((state, index) => {
              const { row } = state;

              if (state.status === 'duplicate') {
                return (
                  <Stack
                    key={`${row.title}-${index}`}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ opacity: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {row.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">already imported</Typography>
                  </Stack>
                );
              }

              if (state.status === 'ready') {
                return (
                  <Stack
                    key={`${row.title}-${index}`}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ opacity: 0.7 }}
                  >
                    <CheckCircleOutlineIcon fontSize="small" color="success" />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {row.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {STATUS_LABEL[row.status]}
                    </Typography>
                  </Stack>
                );
              }

              // needs_date or skipped (skipped rows stay visible so the
              // choice can be reversed before Import)
              return (
                <Box
                  key={`${row.title}-${index}`}
                  sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                >
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                    {row.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Marked read, but no date was logged.
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      type="date"
                      size="small"
                      value={state.completedDate ?? ''}
                      onChange={(e) => onSetCompletedDate(index, e.target.value)}
                      sx={{ maxWidth: 170 }}
                    />
                    <Button size="small" onClick={() => onSkip(index)}>
                      Skip
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {phase === 'importing' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Importing… {progress.done} of {progress.total}
            </Typography>
          </Stack>
        )}

        {phase === 'done' && (
          <Alert severity="success" variant="outlined">
            Imported {summary.imported} {summary.imported === 1 ? 'entry' : 'entries'}
            {summary.skipped > 0 ? `, ${summary.skipped} skipped` : ''}.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {(phase === 'empty' || phase === 'done') && <Button onClick={onClose}>Close</Button>}
        {phase === 'review' && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={onApply} disabled={toImportCount === 0}>
              Import {toImportCount} {toImportCount === 1 ? 'entry' : 'entries'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
