import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import type { TraktReviewData } from '@/services/importExport/traktImportService';

interface TraktReviewPanelProps {
  data: TraktReviewData;
  onToggleMovie: (key: string) => void;
  onToggleWatchlist: (key: string) => void;
  onToggleSeason: (key: string, seasonNumber: number) => void;
  onSetAllIncluded: (value: boolean) => void;
  onConfirm: () => void;
}

/**
 * Review screen for the restructured Trakt sync (fetch → review →
 * apply, the "tick box" feature — see chat). Shared between
 * TraktImportSection's dialog (subsequent syncs) and TraktCallbackPage
 * (first connection), same split as MalDateReviewDialog/MalCallbackPage.
 * Movies and watchlist items are individually tickable; shows use
 * per-season checkboxes (every evidenced season starts ticked — same
 * shape as StreamingImportDialog's show rendering for Netflix/Amazon).
 */
export function TraktReviewPanel({
  data,
  onToggleMovie,
  onToggleWatchlist,
  onToggleSeason,
  onSetAllIncluded,
  onConfirm,
}: TraktReviewPanelProps) {
  const includedMovies = data.movies.filter((m) => m.included).length;
  const includedWatchlist = data.watchlist.filter((w) => w.included).length;
  const includedSeasons = data.shows.reduce((sum, s) => sum + s.includedSeasons.size, 0);
  const toImportCount = includedMovies + includedSeasons + includedWatchlist;

  const totalTickable = data.movies.length + data.watchlist.length + data.shows.length;
  const allIncluded =
    totalTickable === 0 ||
    (data.movies.every((m) => m.included) &&
      data.watchlist.every((w) => w.included) &&
      data.shows.every((s) => s.includedSeasons.size === s.seasonEvidence.size));

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {data.movies.length} movies, {data.shows.length} shows, and {data.watchlist.length} watchlist items
          ready to review.
          {data.duplicateMovieCount + data.duplicateWatchlistCount > 0
            ? ` ${data.duplicateMovieCount + data.duplicateWatchlistCount} already in your library.`
            : ''}
        </Typography>
        {totalTickable > 0 && (
          <Button size="small" onClick={() => onSetAllIncluded(!allIncluded)} sx={{ flexShrink: 0 }}>
            {allIncluded ? 'Deselect all' : 'Select all'}
          </Button>
        )}
      </Stack>

      <Stack spacing={1} sx={{ maxHeight: 380, overflowY: 'auto' }}>
        {data.movies.map((movie) => (
          <Stack key={movie.key} direction="row" alignItems="center" spacing={1}>
            <Checkbox size="small" checked={movie.included} onChange={() => onToggleMovie(movie.key)} />
            <Typography variant="body2" sx={{ flex: 1, opacity: movie.included ? 1 : 0.5 }}>
              {movie.title}
            </Typography>
            <Chip label="Film" size="small" variant="outlined" />
          </Stack>
        ))}

        {data.movies.length > 0 && (data.shows.length > 0 || data.watchlist.length > 0) && <Divider />}

        {data.shows.map((show) => {
          const seasons = Array.from(show.seasonEvidence.keys()).sort((a, b) => a - b);
          return (
            <Box key={show.key}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: seasons.length > 1 ? 0.5 : 0 }}>
                <Checkbox
                  size="small"
                  checked={show.includedSeasons.size === seasons.length}
                  indeterminate={show.includedSeasons.size > 0 && show.includedSeasons.size < seasons.length}
                  onChange={(e) =>
                    seasons.forEach((s) => {
                      const shouldInclude = e.target.checked;
                      if (shouldInclude !== show.includedSeasons.has(s)) onToggleSeason(show.key, s);
                    })
                  }
                />
                <Typography variant="body2" sx={{ flex: 1 }}>{show.title}</Typography>
                <Chip label="TV" size="small" variant="outlined" />
              </Stack>
              {seasons.length > 1 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pl: 4.5 }}>
                  {seasons.map((s) => (
                    <Chip
                      key={s}
                      size="small"
                      label={`Season ${s}`}
                      color={show.includedSeasons.has(s) ? 'primary' : 'default'}
                      variant={show.includedSeasons.has(s) ? 'filled' : 'outlined'}
                      onClick={() => onToggleSeason(show.key, s)}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}

        {data.shows.length > 0 && data.watchlist.length > 0 && <Divider />}

        {data.watchlist.map((item) => (
          <Stack key={item.key} direction="row" alignItems="center" spacing={1}>
            <Checkbox size="small" checked={item.included} onChange={() => onToggleWatchlist(item.key)} />
            <Typography variant="body2" sx={{ flex: 1, opacity: item.included ? 1 : 0.5 }}>
              {item.title}
            </Typography>
            <Chip label={item.mediaType === 'film' ? 'Wishlist · Film' : 'Wishlist · TV'} size="small" variant="outlined" />
          </Stack>
        ))}
      </Stack>

      <Button variant="contained" onClick={onConfirm} disabled={totalTickable === 0}>
        Import {toImportCount} {toImportCount === 1 ? 'item' : 'items'}
      </Button>
    </Stack>
  );
}
