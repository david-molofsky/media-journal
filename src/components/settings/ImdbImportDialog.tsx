import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { MovieMatch, ShowGroup, SkippedRow, SkipReason } from '@/services/importExport/imdbImportService';
import type { ImdbImportPhase } from '@/hooks/useImdbImportFlow';

interface ImdbImportDialogProps {
  open: boolean;
  phase: ImdbImportPhase;
  matchProgress: { done: number; total: number };
  movies: MovieMatch[];
  showGroups: ShowGroup[];
  skipped: SkippedRow[];
  showIndex: number;
  selections: Map<string, Set<number>>;
  skippedShowIds: Set<string>;
  excludedMovies: Set<string>;
  importProgress: { done: number; total: number };
  summary: { filmsImported: number; seasonsImported: number; skipped: SkippedRow[]; seasonsMissingDate: number };
  onBeginShowPrompts: () => void;
  onToggleSeason: (showId: string, seasonNumber: number) => void;
  onToggleMovieIncluded: (imdbId: string) => void;
  onSetAllMoviesIncluded: (value: boolean) => void;
  onFinishShow: (showId: string, skip: boolean) => void;
  onClose: () => void;
}

const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  unsupported_type: 'unsupported type (Video Game, Podcast, Short, Music Video, etc.)',
  no_tmdb_match: 'no TMDB match found for this IMDb ID',
  missing_date: 'no Date Rated recorded',
  show_skipped: 'show skipped',
};

function groupSkippedByReason(skipped: SkippedRow[]): { reason: SkipReason; count: number }[] {
  const counts = new Map<SkipReason, number>();
  for (const { reason } of skipped) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}

/**
 * "Import from IMDb" dialog.
 *
 *   matching     — sequential per-row TMDB /find lookups, progress bar.
 *   review       — every matched movie itemized with a checkbox (the
 *                  "tick box" feature — see chat; previously just a
 *                  count with no way to exclude one), Select
 *                  all/Deselect all, plus expandable skip breakdown.
 *   show_prompt  — one show at a time: IMDb evidence (series rating +
 *                  episodes rated per season) next to unchecked season
 *                  checkboxes, progress dots for position in the list.
 *   importing    — sequential entry-creation progress.
 *   done         — final tally + collapsible "not imported" breakdown.
 *   empty        — nothing readable, or nothing survived matching.
 */
export function ImdbImportDialog({
  open,
  phase,
  matchProgress,
  movies,
  showGroups,
  skipped,
  showIndex,
  selections,
  skippedShowIds,
  excludedMovies,
  importProgress,
  summary,
  onBeginShowPrompts,
  onToggleSeason,
  onToggleMovieIncluded,
  onSetAllMoviesIncluded,
  onFinishShow,
  onClose,
}: ImdbImportDialogProps) {
  const currentShow = showGroups[showIndex];
  const isLastShow = showIndex >= showGroups.length - 1;
  const includedMovieCount = movies.filter((m) => !excludedMovies.has(m.row.imdbId)).length;
  const allMoviesIncluded = excludedMovies.size === 0;

  return (
    <Dialog
      open={open}
      onClose={phase === 'matching' || phase === 'importing' ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Import from IMDb</DialogTitle>
      <DialogContent>
        {phase === 'empty' && (
          <Alert severity="info" variant="outlined">
            {skipped.length > 0
              ? "None of the rows in this file could be matched or imported — see the reasons below."
              : "No readable rows found. Make sure this is IMDb's ratings export CSV, with at least Const, Title and Title Type columns."}
          </Alert>
        )}

        {phase === 'matching' && (
          <Stack spacing={2} sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Matching against TMDB… {matchProgress.done} of {matchProgress.total}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={matchProgress.total ? (matchProgress.done / matchProgress.total) * 100 : 0}
            />
          </Stack>
        )}

        {phase === 'review' && (
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {includedMovieCount} of {movies.length} {movies.length === 1 ? 'film' : 'films'} selected.
                {showGroups.length > 0
                  ? ` ${showGroups.length} ${showGroups.length === 1 ? 'show needs' : 'shows need'} a quick season check.`
                  : ''}
              </Typography>
              {movies.length > 0 && (
                <Button size="small" onClick={() => onSetAllMoviesIncluded(!allMoviesIncluded)} sx={{ flexShrink: 0 }}>
                  {allMoviesIncluded ? 'Deselect all' : 'Select all'}
                </Button>
              )}
            </Stack>

            {movies.length > 0 && (
              <Stack spacing={0.5} sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {movies.map((movie) => {
                  const included = !excludedMovies.has(movie.row.imdbId);
                  return (
                    <FormControlLabel
                      key={movie.row.imdbId}
                      control={
                        <Checkbox
                          size="small"
                          checked={included}
                          onChange={() => onToggleMovieIncluded(movie.row.imdbId)}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ opacity: included ? 1 : 0.5 }}>
                          {movie.row.title}
                        </Typography>
                      }
                    />
                  );
                })}
              </Stack>
            )}

            {skipped.length > 0 && (
              <Accordion variant="outlined" disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2">Not imported ({skipped.length})</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={0.5}>
                    {groupSkippedByReason(skipped).map(({ reason, count }) => (
                      <Typography key={reason} variant="caption" color="text.secondary">
                        {count} row{count === 1 ? '' : 's'} — {SKIP_REASON_LABEL[reason]}
                      </Typography>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        )}

        {phase === 'show_prompt' && currentShow && (
          <Stack spacing={2}>
            <Typography variant="body1" fontWeight={500}>
              {currentShow.title}
            </Typography>
            {currentShow.seriesRating && (
              <Typography variant="caption" color="text.secondary">
                Series rated {currentShow.seriesRating.rating ?? '—'}/10
                {currentShow.seriesRating.date ? ` on ${currentShow.seriesRating.date}` : ''}
              </Typography>
            )}
            <Stack spacing={1}>
              {currentShow.seasonNumbers.map((seasonNumber) => {
                const evidence = currentShow.episodeEvidence.get(seasonNumber);
                return (
                  <FormControlLabel
                    key={seasonNumber}
                    control={
                      <Checkbox
                        checked={selections.get(currentShow.tmdbShowId)?.has(seasonNumber) ?? false}
                        onChange={() => onToggleSeason(currentShow.tmdbShowId, seasonNumber)}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Season {seasonNumber}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {evidence
                            ? `— ${evidence.count} episode${evidence.count === 1 ? '' : 's'} rated`
                            : '— no episodes rated'}
                        </Typography>
                      </Typography>
                    }
                  />
                );
              })}
            </Stack>
            <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ pt: 1 }}>
              {showGroups.map((group, i) => (
                <Box
                  key={group.tmdbShowId}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: i === showIndex ? 'primary.main' : 'action.disabled',
                  }}
                />
              ))}
            </Stack>
          </Stack>
        )}

        {phase === 'importing' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Importing… {importProgress.done} of {importProgress.total}
            </Typography>
          </Stack>
        )}

        {phase === 'done' && (
          <Stack spacing={1.5}>
            <Alert severity="success" variant="outlined">
              Added {summary.filmsImported} film{summary.filmsImported === 1 ? '' : 's'} and{' '}
              {summary.seasonsImported} season{summary.seasonsImported === 1 ? '' : 's'}.
            </Alert>
            {summary.seasonsMissingDate > 0 && (
              <Typography variant="caption" color="text.secondary">
                {summary.seasonsMissingDate} selected season{summary.seasonsMissingDate === 1 ? '' : 's'}{' '}
                couldn't be added — no rated episodes or series date to log a completion date from.
              </Typography>
            )}
            {summary.skipped.length > 0 && (
              <Accordion variant="outlined" disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2">Not imported ({summary.skipped.length})</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={0.5}>
                    {groupSkippedByReason(summary.skipped).map(({ reason, count }) => (
                      <Typography key={reason} variant="caption" color="text.secondary">
                        {count} row{count === 1 ? '' : 's'} — {SKIP_REASON_LABEL[reason]}
                      </Typography>
                    ))}
                    {skippedShowIds.size > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {skippedShowIds.size} show{skippedShowIds.size === 1 ? '' : 's'} — {SKIP_REASON_LABEL.show_skipped}
                      </Typography>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {(phase === 'empty' || phase === 'done') && <Button onClick={onClose}>Close</Button>}
        {phase === 'review' && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={onBeginShowPrompts}
              disabled={showGroups.length === 0 && includedMovieCount === 0}
            >
              {showGroups.length > 0 ? 'Continue' : `Import ${includedMovieCount}`}
            </Button>
          </>
        )}
        {phase === 'show_prompt' && currentShow && (
          <>
            <Button onClick={() => onFinishShow(currentShow.tmdbShowId, true)}>Skip this show</Button>
            <Button variant="contained" onClick={() => onFinishShow(currentShow.tmdbShowId, false)}>
              {isLastShow ? 'Import' : 'Next'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
