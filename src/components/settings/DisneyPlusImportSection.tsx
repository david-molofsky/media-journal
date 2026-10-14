import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';
import {
  applyDisneyPlusImport,
  parseDisneyPlusWorkbook,
  type DisneyPlusItem,
  type DisneyPlusPreview,
} from '@/services/importExport/disneyPlusImportService';
import {
  trackImportCompleted,
  trackImportFailed,
  trackImportStarted,
} from '@/services/analytics/importAnalytics';
export function DisneyPlusImportSection({
  open,
  onCloseInstructions,
}: {
  open: boolean;
  onCloseInstructions: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'review' | 'applying' | 'done' | 'error'>(
    'idle',
  );
  const [items, setItems] = useState<DisneyPlusItem[]>([]);
  const [preview, setPreview] = useState<DisneyPlusPreview | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const choose = () => ref.current?.click();
  const fileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setError('');
      const result = await parseDisneyPlusWorkbook(await f.arrayBuffer(), {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setItems(result.items);
      setPreview(result.preview);
      setPhase('review');
      onCloseInstructions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not read this Disney+ export.',
      );
      setPhase('error');
      onCloseInstructions();
    }
  };
  const reset = () => {
    setPhase('idle');
    setItems([]);
    setPreview(null);
    setError('');
    setCount(0);
  };
  const apply = async () => {
    setPhase('applying');
    trackImportStarted('disney_plus', 'xlsx');
    try {
      const n = await applyDisneyPlusImport(items);
      setCount(n);
      trackImportCompleted('disney_plus', 'xlsx', {
        itemsFound: preview?.rows ?? 0,
        itemsImported: n,
        itemsSkipped: Math.max(0, items.length - n),
        itemsFlagged: preview?.ignored ?? 0,
      });
      setPhase('done');
    } catch {
      trackImportFailed('disney_plus', 'xlsx', 'apply');
      setError('Import failed. Check your library before retrying.');
      setPhase('error');
    }
  };
  return (
    <>
      <ImportInstructionsDialog
        open={open}
        onClose={onCloseInstructions}
        title="Import from Disney+"
        buttonLabel="Choose Excel file"
        onChoose={choose}
        description={
          <>
            Choose the Disney+ viewing-history .xlsx export. Movie rows are consolidated
            into sessions using start/end timestamps, preserving dates across midnight.
            Episode rows are grouped by series and season numbers are left blank.
            Re-imported sessions are skipped.
          </>
        }
      />
      <input
        ref={ref}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={fileChange}
      />
      <Dialog
        open={phase !== 'idle'}
        onClose={() => phase !== 'applying' && reset()}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Disney+ viewing history</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {phase === 'review' && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Optional inclusive filters use the export's viewing date. Leave blank
                  for all history. Change a filter and choose the file again to refresh
                  the preview.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Start date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button onClick={choose}>Re-select file</Button>
                </Stack>
                <Box>
                  <Typography variant="body2">
                    Rows in range: {preview?.rows ?? 0}
                  </Typography>
                  <Typography variant="body2">
                    Film sessions: {preview?.films ?? 0}
                  </Typography>
                  <Typography variant="body2">
                    TV series: {preview?.shows ?? 0}
                  </Typography>
                  <Typography variant="body2">
                    Unsupported rows skipped: {preview?.ignored ?? 0}
                  </Typography>
                </Box>
                {items.slice(0, 8).map((i) => (
                  <Box
                    key={i.key}
                    sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {i.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {i.mediaType === 'film' ? 'Film' : 'TV series'} · {i.startedDate} →{' '}
                      {i.completedDate} · {i.sessionCount} source rows
                    </Typography>
                  </Box>
                ))}
                {items.length > 8 && (
                  <Typography variant="caption" color="text.secondary">
                    Showing 8 of {items.length} items.
                  </Typography>
                )}
                {!items.length && (
                  <Alert severity="success">No new sessions to import.</Alert>
                )}
              </>
            )}
            {phase === 'applying' && (
              <Typography>Importing {items.length} items…</Typography>
            )}
            {phase === 'done' && (
              <Alert severity="success">{count} entries imported.</Alert>
            )}
            {phase === 'error' && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={reset} disabled={phase === 'applying'}>
            {phase === 'done' || phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
          {phase === 'review' && (
            <Button
              variant="contained"
              onClick={() => void apply()}
              disabled={!items.length}
            >
              Import {items.length} items
            </Button>
          )}
          {phase === 'error' && (
            <Button variant="contained" onClick={choose}>
              Choose another file
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
