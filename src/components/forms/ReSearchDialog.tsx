import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import type { ReSearchDiffSet } from '@/utils/reSearchDiff';

interface ReSearchDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  /** "Open Library" / "TMDB" / "ComicVine" — shown in the subtitle. */
  sourceLabel: string;
  newTitle: string;
  diffSet: ReSearchDiffSet | null;
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

/**
 * Shown by EntryForm's Re-search button (see chat, Aug 2026) once a
 * fresh search turns up at least one field that differs from what's
 * already on the entry. Only differing fields are listed — anything
 * that already matches never appears here at all (EntryForm shows a
 * quiet toast instead when nothing differs). Genres are always
 * additive: the row lists only genres the fresh result has that the
 * entry doesn't, never a removal.
 */
export function ReSearchDialog({
  open,
  loading,
  error,
  sourceLabel,
  newTitle,
  diffSet,
  selectedKeys,
  onToggle,
  onApply,
  onCancel,
}: ReSearchDialogProps) {
  const selectedCount = diffSet
    ? [
        diffSet.titleDiff ? selectedKeys.has('title') : false,
        ...diffSet.fieldDiffs.map((d) => selectedKeys.has(d.key)),
        diffSet.genreAdds.length > 0 ? selectedKeys.has('genres') : false,
      ].filter(Boolean).length
    : 0;

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Update from source?</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 3 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Searching {sourceLabel}…
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        ) : diffSet ? (
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {sourceLabel} · found a closer match for "{newTitle}"
            </Typography>

            {diffSet.titleDiff && (
              <DiffRow
                label="Title"
                oldValue={diffSet.titleDiff.oldValue}
                newValue={diffSet.titleDiff.newValue}
                checked={selectedKeys.has('title')}
                onToggle={() => onToggle('title')}
              />
            )}
            {diffSet.fieldDiffs.map((diff) => (
              <DiffRow
                key={diff.key}
                label={diff.label}
                oldValue={diff.oldDisplay}
                newValue={diff.newDisplay}
                checked={selectedKeys.has(diff.key)}
                onToggle={() => onToggle(diff.key)}
              />
            ))}
            {diffSet.genreAdds.length > 0 && (
              <DiffRow
                label="Genres"
                oldValue={null}
                newValue={diffSet.genreAdds.join(', ')}
                checked={selectedKeys.has('genres')}
                onToggle={() => onToggle('genres')}
                additive
              />
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        {!loading && !error && diffSet && (
          <Button variant="contained" disabled={selectedCount === 0} onClick={onApply}>
            Apply Selected {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function DiffRow({
  label,
  oldValue,
  newValue,
  checked,
  onToggle,
  additive = false,
}: {
  label: string;
  oldValue: string | null;
  newValue: string;
  checked: boolean;
  onToggle: () => void;
  additive?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ py: 0.75 }}>
      <Checkbox size="small" checked={checked} onChange={onToggle} sx={{ mt: -0.5 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          {oldValue && (
            <Typography
              variant="body2"
              sx={{ textDecoration: 'line-through', color: 'error.main', opacity: 0.8 }}
            >
              {oldValue}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {oldValue ? '→' : additive ? '+' : ''}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="success.main">
            {newValue}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
