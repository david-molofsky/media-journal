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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import type { LetterboxdMatchState } from '@/services/importExport/letterboxdImportService';
import type { LetterboxdImportPhase } from '@/hooks/useLetterboxdImportFlow';

interface LetterboxdImportDialogProps {
  open: boolean;
  phase: LetterboxdImportPhase;
  matches: LetterboxdMatchState[];
  progress: { done: number; total: number };
  summary: { imported: number; skipped: number };
  onPickCandidate: (index: number, tmdbId: string) => void;
  onSkip: (index: number) => void;
  onSetImportAnyway: (index: number, value: boolean) => void;
  onSetIncluded: (index: number, value: boolean) => void;
  onSetAllIncluded: (value: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * "Import from Letterboxd" dialog. Purely presentational — all state
 * and async work live in useLetterboxdImportFlow, same split as
 * BackfillDialog / useBackfillFlow, which this deliberately mirrors:
 *
 *   matching  — sequential per-row TMDB search progress.
 *   review    — auto-matched rows are now tickable (the "tick box"
 *               feature — previously locked in with no way to opt
 *               out short of skipping the whole import); duplicate
 *               rows stay locked-in as before; ambiguous rows let the
 *               person pick a candidate or skip; "no match" rows
 *               default to importing under the raw Letterboxd title,
 *               with a checkbox to opt out.
 *   importing — sequential per-row entry-creation progress.
 *   done      — short summary.
 *   empty     — the file had no readable diary rows.
 */
export function LetterboxdImportDialog({
  open,
  phase,
  matches,
  progress,
  summary,
  onPickCandidate,
  onSkip,
  onSetImportAnyway,
  onSetIncluded,
  onSetAllIncluded,
  onApply,
  onClose,
}: LetterboxdImportDialogProps) {
  const autoCount = matches.filter((m) => m.status === 'auto').length;
  const needsInputCount = matches.filter((m) => m.status === 'ambiguous' || m.status === 'none').length;
  const duplicateCount = matches.filter((m) => m.status === 'duplicate').length;
  const toImportCount = matches.filter(
    (m) =>
      (m.status === 'auto' && m.included) ||
      (m.status === 'ambiguous' && m.selectedId) ||
      (m.status === 'none' && m.importAnyway),
  ).length;
  const allAutoIncluded = autoCount === 0 || matches.every((m) => m.status !== 'auto' || m.included);

  return (
    <Dialog open={open} onClose={phase === 'importing' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import from Letterboxd</DialogTitle>
      <DialogContent>
        {phase === 'matching' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Checking TMDB… {progress.done} of {progress.total || '…'}
            </Typography>
          </Stack>
        )}

        {phase === 'empty' && (
          <Alert severity="info" variant="outlined">
            No readable diary rows found. Make sure this is Letterboxd's diary.csv, with at
            least a Name and a Watched Date (or Date) column.
          </Alert>
        )}

        {phase === 'review' && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {autoCount} matched automatically. {needsInputCount} need your input.
                {duplicateCount > 0 ? ` ${duplicateCount} already in your library.` : ''}
              </Typography>
              {autoCount > 0 && (
                <Button size="small" onClick={() => onSetAllIncluded(!allAutoIncluded)} sx={{ flexShrink: 0 }}>
                  {allAutoIncluded ? 'Deselect all' : 'Select all'}
                </Button>
              )}
            </Stack>

            {matches.map((match, index) => {
              if (match.status === 'duplicate') {
                return (
                  <Stack
                    key={`${match.row.name}-${match.row.watchedDate}-${index}`}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ opacity: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {match.row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">already imported</Typography>
                  </Stack>
                );
              }

              if (match.status === 'auto') {
                return (
                  <Stack
                    key={`${match.row.name}-${match.row.watchedDate}-${index}`}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                  >
                    <Checkbox
                      size="small"
                      checked={match.included}
                      onChange={(e) => onSetIncluded(index, e.target.checked)}
                    />
                    <CheckCircleOutlineIcon fontSize="small" color="success" />
                    <Typography variant="body2" sx={{ flex: 1, opacity: match.included ? 1 : 0.5 }}>
                      {match.row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">matched</Typography>
                  </Stack>
                );
              }

              if (match.status === 'none') {
                return (
                  <Box
                    key={`${match.row.name}-${match.row.watchedDate}-${index}`}
                    sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                  >
                    <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                      {match.row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      No match found on TMDB.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={match.importAnyway ?? true}
                          onChange={(e) => onSetImportAnyway(index, e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="body2">
                          Import anyway, using the Letterboxd title
                        </Typography>
                      }
                    />
                  </Box>
                );
              }

              // ambiguous or skipped (skipped rows stay visible so the
              // choice can be reversed before Import)
              return (
                <Box
                  key={`${match.row.name}-${match.row.watchedDate}-${index}`}
                  sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                >
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                    {match.row.name}
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
