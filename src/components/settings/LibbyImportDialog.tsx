import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { EntryStatus, MediaType } from '@/models';
import type { LibbyImportPhase } from '@/hooks/useLibbyImportFlow';
import type { LibbyRowState } from '@/services/importExport/libbyImportService';

interface LibbyImportDialogProps {
  open: boolean;
  phase: LibbyImportPhase;
  rows: LibbyRowState[];
  mediaTypes: MediaType[];
  progress: { done: number; total: number };
  summary: { imported: number; updated: number; skipped: number };
  error: string;
  onSetEntryStatus: (index: number, status: EntryStatus) => void;
  onSetCompletedDate: (index: number, date: string) => void;
  onSetMediaType: (index: number, mediaType: string) => void;
  onSetIncluded: (index: number, value: boolean) => void;
  onSetAllIncluded: (value: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<EntryStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  wishlist: 'Wishlist',
};

export function LibbyImportDialog({
  open,
  phase,
  rows,
  mediaTypes,
  progress,
  summary,
  error,
  onSetEntryStatus,
  onSetCompletedDate,
  onSetMediaType,
  onSetIncluded,
  onSetAllIncluded,
  onApply,
  onClose,
}: LibbyImportDialogProps) {
  const readyCount = rows.filter((row) => row.status === 'ready').length;
  const duplicateCount = rows.filter((row) => row.status === 'duplicate').length;
  const newLoanCount = rows.filter((row) => row.status === 'new_loans').length;
  const toImportCount = rows.filter((state) => {
    if (!state.included || state.status === 'duplicate' || state.status === 'skipped')
      return false;
    return (
      state.status === 'new_loans' ||
      state.entryStatus !== 'completed' ||
      Boolean(state.completedDate)
    );
  }).length;
  const allIncluded = rows.every((row) => row.status === 'duplicate' || row.included);
  const missingCompletionDateCount = rows.filter(
    (row) =>
      row.status === 'ready' &&
      row.included &&
      row.entryStatus === 'completed' &&
      !row.completedDate,
  ).length;

  return (
    <Dialog
      open={open}
      onClose={phase === 'importing' ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Import from Libby</DialogTitle>
      <DialogContent>
        {phase === 'empty' && (
          <Alert severity="info" variant="outlined">
            No borrowed titles were found. Choose a Libby version 1 timeline JSON export.
          </Alert>
        )}
        {phase === 'error' && (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        )}

        {phase === 'review' && (
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined">
              Libby records borrow dates, not completion dates. Borrow dates are saved as
              start dates; new entries default to In progress. Choose Completed only when
              you know the finish date.
            </Alert>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="body2" color="text.secondary">
                {readyCount} new titles · {newLoanCount} existing titles with new loan
                dates
                {duplicateCount ? ` · ${duplicateCount} already imported` : ''}
              </Typography>
              <Button
                size="small"
                onClick={() => onSetAllIncluded(!allIncluded)}
                sx={{ flexShrink: 0 }}
              >
                {allIncluded ? 'Deselect all' : 'Select all'}
              </Button>
            </Stack>

            {rows.map((state, index) => {
              const { row } = state;
              const latestDate = row.borrowDates[row.borrowDates.length - 1];
              const repeatText =
                row.borrowDates.length > 1
                  ? `Borrowed ${row.borrowDates.length} times`
                  : 'Borrowed once';

              if (state.status === 'duplicate') {
                return (
                  <Stack
                    key={row.itemKey}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ opacity: 0.55 }}
                  >
                    <Checkbox size="small" checked={false} disabled />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2">{row.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.author ?? row.publisher ?? 'Libby'} · {repeatText}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Already imported
                    </Typography>
                  </Stack>
                );
              }

              return (
                <Box
                  key={row.itemKey}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Checkbox
                      size="small"
                      checked={state.included}
                      onChange={(event) => onSetIncluded(index, event.target.checked)}
                      sx={{ mt: -0.75, ml: -1 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {row.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        {[
                          row.author,
                          row.publisher,
                          row.isbn ? `ISBN ${row.isbn}` : undefined,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mb: 1 }}
                      >
                        {repeatText}
                        {latestDate ? ` · latest loan ${latestDate}` : ''}
                        {state.status === 'new_loans'
                          ? ' · new loan dates will be added to the existing entry'
                          : ''}
                      </Typography>

                      {state.status === 'ready' && (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <FormControl size="small" fullWidth>
                            <InputLabel id={`libby-type-${index}`}>Type</InputLabel>
                            <Select
                              labelId={`libby-type-${index}`}
                              value={row.mediaType}
                              label="Type"
                              onChange={(event) =>
                                onSetMediaType(index, event.target.value)
                              }
                            >
                              {mediaTypes.map((type) => (
                                <MenuItem key={type.id} value={type.id}>
                                  {type.displayName}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl size="small" fullWidth>
                            <InputLabel id={`libby-status-${index}`}>Status</InputLabel>
                            <Select
                              labelId={`libby-status-${index}`}
                              value={state.entryStatus}
                              label="Status"
                              onChange={(event) =>
                                onSetEntryStatus(index, event.target.value as EntryStatus)
                              }
                            >
                              {(Object.keys(STATUS_LABEL) as EntryStatus[]).map(
                                (status) => (
                                  <MenuItem key={status} value={status}>
                                    {STATUS_LABEL[status]}
                                  </MenuItem>
                                ),
                              )}
                            </Select>
                          </FormControl>
                        </Stack>
                      )}

                      {state.status === 'ready' && state.entryStatus === 'completed' && (
                        <TextField
                          type="date"
                          label="Completed date"
                          size="small"
                          fullWidth
                          value={state.completedDate ?? ''}
                          onChange={(event) =>
                            onSetCompletedDate(index, event.target.value)
                          }
                          inputProps={{ min: row.borrowDates[0] }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ mt: 1 }}
                        />
                      )}
                      {state.status === 'ready' && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.75 }}
                        >
                          Started {row.borrowDates[0] || 'date unavailable'}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              );
            })}
            {missingCompletionDateCount > 0 && (
              <Alert severity="warning" variant="outlined">
                Add a completed date or change the status for {missingCompletionDateCount}{' '}
                {missingCompletionDateCount === 1 ? 'title' : 'titles'} marked Completed.
              </Alert>
            )}
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
            Added {summary.imported} {summary.imported === 1 ? 'title' : 'titles'}
            {summary.updated
              ? ` and updated loan history for ${summary.updated} existing ${summary.updated === 1 ? 'title' : 'titles'}`
              : ''}
            {summary.skipped ? `; skipped ${summary.skipped}` : ''}.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {(phase === 'empty' || phase === 'error' || phase === 'done') && (
          <Button onClick={onClose}>Close</Button>
        )}
        {phase === 'review' && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={onApply}
              disabled={toImportCount === 0 || missingCompletionDateCount > 0}
            >
              Import {toImportCount} {toImportCount === 1 ? 'entry' : 'entries'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
