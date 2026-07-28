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
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import type { ReviewItem, ApplyResult } from '@/services/importExport/streamingImportShared';

interface StreamingImportDialogProps {
  open: boolean;
  title: string;
  phase: 'idle' | 'matching' | 'review' | 'importing' | 'done' | 'empty';
  items: ReviewItem[];
  progress: { done: number; total: number };
  summary: ApplyResult;
  onPickMovieCandidate: (key: string, tmdbId: string) => void;
  onSkipMovie: (key: string) => void;
  onSetMovieIncluded: (key: string, value: boolean) => void;
  onPickShowCandidate: (key: string, tmdbId: string) => void;
  onToggleSeason: (key: string, seasonNumber: number) => void;
  onSetAllIncluded: (value: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * Review/tick step shared by the Netflix and Amazon Prime Video import
 * flows (streamingImportShared.ts owns the underlying matching/apply
 * logic, this owns the presentation). Same overall shape as
 * LetterboxdImportDialog — matching/review/importing/done/empty phases
 * — but every successfully-matched item (movie or season) now has a
 * checkbox rather than being locked in, plus a Select all/Deselect all
 * pair at the top of the review list. Movies and show-season groups
 * render as one flat scrollable list; a filter-by-type control was
 * considered but left out of this first version for simplicity.
 */
export function StreamingImportDialog({
  open,
  title,
  phase,
  items,
  progress,
  summary,
  onPickMovieCandidate,
  onSkipMovie,
  onSetMovieIncluded,
  onPickShowCandidate,
  onToggleSeason,
  onSetAllIncluded,
  onApply,
  onClose,
}: StreamingImportDialogProps) {
  const movies = items.filter((i) => i.kind === 'movie');
  const shows = items.filter((i) => i.kind === 'show');

  const moviesToImport = movies.filter((m) => m.status !== 'duplicate' && m.status !== 'skipped' && m.status !== 'none' && m.included && m.selectedId).length;
  const seasonsToImport = shows.reduce((sum, s) => sum + (s.status === 'none' ? 0 : s.includedSeasons.size), 0);
  const toImportCount = moviesToImport + seasonsToImport;
  const unmatchedCount = movies.filter((m) => m.status === 'none').length + shows.filter((s) => s.status === 'none').length;
  const duplicateCount = movies.filter((m) => m.status === 'duplicate').length;

  return (
    <Dialog open={open} onClose={phase === 'importing' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {(phase === 'matching' || phase === 'importing') && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              {phase === 'matching' ? 'Checking TMDB…' : 'Importing…'} {progress.done} of {progress.total || '…'}
            </Typography>
          </Stack>
        )}

        {phase === 'empty' && (
          <Alert severity="info" variant="outlined">
            No readable rows found in that file.
          </Alert>
        )}

        {phase === 'review' && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {toImportCount} selected
                {duplicateCount > 0 ? ` · ${duplicateCount} already in your library` : ''}
                {unmatchedCount > 0 ? ` · ${unmatchedCount} unmatched` : ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => onSetAllIncluded(true)}>Select all</Button>
                <Button size="small" onClick={() => onSetAllIncluded(false)}>Deselect all</Button>
              </Stack>
            </Stack>
            <Divider />

            {movies.map((movie) => {
              if (movie.status === 'duplicate') {
                return (
                  <Stack key={movie.key} direction="row" alignItems="center" spacing={1} sx={{ opacity: 0.5 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>{movie.title}</Typography>
                    <Typography variant="caption" color="text.secondary">already imported</Typography>
                  </Stack>
                );
              }

              if (movie.status === 'auto') {
                return (
                  <Stack key={movie.key} direction="row" alignItems="center" spacing={1}>
                    <Checkbox
                      size="small"
                      checked={movie.included}
                      onChange={(e) => onSetMovieIncluded(movie.key, e.target.checked)}
                    />
                    <CheckCircleOutlineIcon fontSize="small" color="success" />
                    <Typography variant="body2" sx={{ flex: 1 }}>{movie.title}</Typography>
                    <Typography variant="caption" color="text.secondary">Film</Typography>
                  </Stack>
                );
              }

              if (movie.status === 'none') {
                return (
                  <Box key={movie.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>{movie.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      No match found on TMDB.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={movie.included}
                          onChange={(e) => onSetMovieIncluded(movie.key, e.target.checked)}
                        />
                      }
                      label={<Typography variant="body2">Import anyway, using the raw title</Typography>}
                    />
                  </Box>
                );
              }

              // ambiguous or skipped — skipped rows stay visible so the
              // choice can be reversed before Import.
              return (
                <Box key={movie.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>{movie.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Multiple close matches on TMDB. Pick one, or skip.
                  </Typography>
                  <RadioGroup
                    value={movie.status === 'skipped' ? '' : (movie.selectedId ?? '')}
                    onChange={(_, value) => onPickMovieCandidate(movie.key, value)}
                  >
                    {movie.candidates.map((c) => (
                      <FormControlLabel
                        key={c.id}
                        value={c.id}
                        control={<Radio size="small" />}
                        label={<Typography variant="body2">{c.title}{c.subtitle ? ` (${c.subtitle})` : ''}</Typography>}
                      />
                    ))}
                  </RadioGroup>
                  <Button size="small" onClick={() => onSkipMovie(movie.key)} sx={{ mt: 0.5 }}>
                    Skip this entry
                  </Button>
                </Box>
              );
            })}

            {shows.map((show) => {
              if (show.status === 'none') {
                return (
                  <Box key={show.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, opacity: 0.7 }}>
                    <Typography variant="body2" fontWeight={500}>{show.title}</Typography>
                    <Typography variant="caption" color="text.secondary">No match found on TMDB — skipped.</Typography>
                  </Box>
                );
              }

              const seasonNumbers = Array.from(show.seasonEvidence.keys()).sort((a, b) => a - b);
              return (
                <Box key={show.key} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>{show.title}</Typography>

                  {show.status === 'ambiguous' && (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Multiple close matches on TMDB. Pick the right show.
                      </Typography>
                      <RadioGroup
                        value={show.selectedId ?? ''}
                        onChange={(_, value) => onPickShowCandidate(show.key, value)}
                        sx={{ mb: 1 }}
                      >
                        {show.candidates.map((c) => (
                          <FormControlLabel
                            key={c.id}
                            value={c.id}
                            control={<Radio size="small" />}
                            label={<Typography variant="body2">{c.title}{c.subtitle ? ` (${c.subtitle})` : ''}</Typography>}
                          />
                        ))}
                      </RadioGroup>
                    </>
                  )}

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {seasonNumbers.map((seasonNumber) => (
                      <Chip
                        key={seasonNumber}
                        size="small"
                        label={`Season ${seasonNumber}${show.hasGap ? ' · Gap' : ''}`}
                        color={show.includedSeasons.has(seasonNumber) ? 'primary' : 'default'}
                        variant={show.includedSeasons.has(seasonNumber) ? 'filled' : 'outlined'}
                        onClick={() => onToggleSeason(show.key, seasonNumber)}
                      />
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {phase === 'done' && (
          <Stack spacing={0.5}>
            <Alert severity="success" variant="outlined">
              Imported {summary.moviesImported} {summary.moviesImported === 1 ? 'movie' : 'movies'} and{' '}
              {summary.seasonsImported} {summary.seasonsImported === 1 ? 'season' : 'seasons'}.
            </Alert>
            {summary.flaggedForReview > 0 && (
              <Typography variant="caption" color="text.secondary">
                {summary.flaggedForReview} show{summary.flaggedForReview === 1 ? '' : 's'} had a season gap — worth a quick check in your Library.
              </Typography>
            )}
            {summary.unmatched > 0 && (
              <Typography variant="caption" color="text.secondary">
                {summary.unmatched} unmatched, not imported.
              </Typography>
            )}
          </Stack>
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
