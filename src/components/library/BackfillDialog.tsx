import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import type { MatchState } from '@/services/metadata/backfillService';
import type { BackfillPhase } from '@/hooks/useBackfillFlow';

interface BackfillDialogProps {
  open: boolean;
  phase: BackfillPhase;
  matches: MatchState[];
  progress: { done: number; total: number };
  summary: { updated: number; skipped: number };
  onPickCandidate: (index: number, tmdbId: string) => void;
  onSkip: (index: number) => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * Bulk-select "Back-fill missing fields" dialog (Library > Select).
 * Purely presentational — all state and async work live in
 * useBackfillFlow, which BulkActionBar starts from the Back-fill
 * button's onClick. This component just renders whichever phase it's
 * handed:
 *
 *   searching — sequential per-entry TMDB search progress.
 *   review    — auto-matched entries shown locked-in; ambiguous ones
 *               let the person pick a candidate or skip; "no match"
 *               entries are skip-only.
 *   applying  — sequential per-entry apply progress.
 *   done      — short summary.
 *   empty     — nothing in the selection needed backfilling.
 */
export function BackfillDialog({
  open,
  phase,
  matches,
  progress,
  summary,
  onPickCandidate,
  onSkip,
  onApply,
  onClose,
}: BackfillDialogProps) {
  return (
    <Dialog open={open} onClose={phase === 'applying' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Back-fill missing fields</DialogTitle>
      <DialogContent>
        {phase === 'searching' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Checking TMDB… {progress.done} of {progress.total || '…'}
            </Typography>
          </Stack>
        )}

        {phase === 'empty' && (
          <Alert severity="info" variant="outlined">
            Nothing to back-fill — the selected entries are either not Film/TV, or already have
            every currently-enabled field filled in.
          </Alert>
        )}

        {phase === 'review' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {matches.filter((m) => m.status === 'auto').length} matched automatically.{' '}
              {matches.filter((m) => m.status === 'ambiguous' || m.status === 'none').length} need
              your input.
            </Typography>

            {matches.map((match, index) => {
              if (match.status === 'auto') {
                return (
                  <Stack
                    key={match.entry.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ opacity: 0.7 }}
                  >
                    <CheckCircleOutlineIcon fontSize="small" color="success" />
                    <Typography variant="body2" sx={{ flex: 1 }}>{match.entry.title}</Typography>
                    <Typography variant="caption" color="text.secondary">matched</Typography>
                  </Stack>
                );
              }

              if (match.status === 'none') {
                return (
                  <Box key={match.entry.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={500}>{match.entry.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      No match found on TMDB — will be skipped.
                    </Typography>
                  </Box>
                );
              }

              // ambiguous or skipped (skipped entries stay visible so the
              // choice can be reversed before Apply)
              return (
                <Box key={match.entry.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                    {match.entry.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Multiple close matches on TMDB. Pick one, or skip.
                  </Typography>
                  <RadioGroup
                    value={match.status === 'skipped' ? '' : (match.selectedId ?? '')}
                    onChange={(_, value) => onPickCandidate(index, value)}
                  >
                    {match.candidates.map((c) => (
                      <FormControlLabel
                        key={c.id}
                        value={c.id}
                        control={<Radio size="small" />}
                        label={
                          <Typography variant="body2">
                            {c.title}{c.subtitle ? ` (${c.subtitle})` : ''}
                          </Typography>
                        }
                      />
                    ))}
                  </RadioGroup>
                  <Button size="small" onClick={() => onSkip(index)} sx={{ mt: 0.5 }}>
                    Skip this entry
                  </Button>
                </Box>
              );
            })}
          </Stack>
        )}

        {phase === 'applying' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Back-filling… {progress.done} of {progress.total}
            </Typography>
          </Stack>
        )}

        {phase === 'done' && (
          <Alert severity="success" variant="outlined">
            Backfilled {summary.updated} {summary.updated === 1 ? 'entry' : 'entries'}
            {summary.skipped > 0 ? `, ${summary.skipped} skipped` : ''}.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {(phase === 'empty' || phase === 'done') && <Button onClick={onClose}>Close</Button>}
        {phase === 'review' && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={onApply}>Apply and back-fill</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
