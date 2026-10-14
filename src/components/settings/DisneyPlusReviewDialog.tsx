import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { DisneyPlusItem } from '@/services/importExport/disneyPlusImportService';

export interface DisneyPlusReviewItem extends DisneyPlusItem {
  candidates: { id: string; title: string; subtitle?: string }[];
  selectedId?: string;
  matchStatus: 'auto' | 'ambiguous' | 'none';
  included: boolean;
}

interface Props {
  open: boolean;
  phase: 'matching' | 'review' | 'applying' | 'done' | 'error';
  items: DisneyPlusReviewItem[];
  count: number;
  error: string;
  onPick: (key: string, value: string) => void;
  onInclude: (key: string, included: boolean) => void;
  onSelectAll: (included: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

export function DisneyPlusReviewDialog({ open, phase, items, count, error, onPick, onInclude, onSelectAll, onApply, onClose }: Props) {
  const selected = items.filter((item) => item.included).length;
  const unmatched = items.filter((item) => item.matchStatus === 'none').length;
  return (
    <Dialog open={open} onClose={phase === 'applying' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import from Disney+</DialogTitle>
      <DialogContent>
        {phase === 'matching' && <Stack alignItems="center" spacing={2} sx={{ py: 4 }}><CircularProgress size={28} /><Typography variant="body2" color="text.secondary">Checking TMDB matches…</Typography></Stack>}
        {phase === 'applying' && <Stack alignItems="center" spacing={2} sx={{ py: 4 }}><CircularProgress size={28} /><Typography variant="body2" color="text.secondary">Importing selected entries…</Typography></Stack>}
        {phase === 'review' && <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">Review matches before adding entries. Your existing library is not changed during preview.</Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">{selected} selected · {unmatched} without a match</Typography>
            <Stack direction="row" spacing={0.5}><Button size="small" onClick={() => onSelectAll(true)}>Select all</Button><Button size="small" onClick={() => onSelectAll(false)}>Deselect all</Button></Stack>
          </Stack>
          {items.map((item) => <Box key={item.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <FormControlLabel control={<Checkbox size="small" checked={item.included} onChange={(e) => onInclude(item.key, e.target.checked)} />} label={<Typography variant="body2" fontWeight={600}>{item.title}</Typography>} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, ml: 4 }}>
              {item.mediaType === 'film' ? 'Film' : 'TV series'} · {item.startedDate} – {item.completedDate} · {item.sessionCount} activity rows · Profile: {item.profile}
            </Typography>
            {item.matchStatus === 'auto' && <Typography variant="caption" color="success.main" sx={{ ml: 4, display: 'block' }}>Exact title match</Typography>}
            {item.matchStatus !== 'auto' && <><Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block', mb: 0.5 }}>{item.matchStatus === 'ambiguous' ? 'Choose the matching TMDB entry, or keep the original title.' : 'No confident match found. You can keep the original title.'}</Typography>
              <RadioGroup value={item.selectedId ?? '__raw__'} onChange={(_, value) => onPick(item.key, value)} sx={{ ml: 4 }}>
                {item.candidates.map((candidate) => <FormControlLabel key={candidate.id} value={candidate.id} control={<Radio size="small" />} label={<Typography variant="body2">{candidate.title}{candidate.subtitle ? ` (${candidate.subtitle})` : ''}</Typography>} />)}
                <FormControlLabel value="__raw__" control={<Radio size="small" />} label={<Typography variant="body2">Import without match — keep original title</Typography>} />
              </RadioGroup>
            </>}
          </Box>)}
          {!items.length && <Alert severity="info">No new sessions to import.</Alert>}
        </Stack>}
        {phase === 'done' && <Alert severity="success">{count} entries imported.</Alert>}
        {phase === 'error' && <Alert severity="error">{error || 'Import failed. Check your library before retrying.'}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={phase === 'applying'}>{phase === 'done' || phase === 'error' ? 'Close' : 'Cancel'}</Button>
        {phase === 'review' && <Button variant="contained" onClick={onApply} disabled={!selected}>Import {selected} selected</Button>}
      </DialogActions>
    </Dialog>
  );
}
