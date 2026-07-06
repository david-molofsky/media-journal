import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { deleteEntries, bulkAddTags, bulkSetRating, bulkSetSource } from '@/services/database/entryService';
import { TagInput } from '@/components/forms/TagInput';
import { useAvailableSources } from '@/hooks/useAvailableSources';
import { useBackfillFlow } from '@/hooks/useBackfillFlow';
import { BackfillDialog } from './BackfillDialog';

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
}

/**
 * Sticky action bar that appears at the bottom of the Library when one
 * or more entries are selected. Provides Tag, Source, Rate and Delete
 * actions that apply to all selected entries simultaneously.
 */
export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValues, setTagValues] = useState<string[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceValue, setSourceValue] = useState('');
  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState<number>(7);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const backfill = useBackfillFlow();
  const availableSources = useAvailableSources();

  const count = selectedIds.length;

  const handleTag = async () => {
    if (tagValues.length > 0) {
      await bulkAddTags(selectedIds, tagValues);
    }
    setTagOpen(false);
    setTagValues([]);
    onClear();
  };

  const handleSource = async () => {
    const trimmed = sourceValue.trim();
    if (trimmed) {
      await bulkSetSource(selectedIds, trimmed);
    }
    setSourceOpen(false);
    setSourceValue('');
    onClear();
  };

  const handleRate = async () => {
    await bulkSetRating(selectedIds, rateValue);
    setRateOpen(false);
    onClear();
  };

  const handleDelete = async () => {
    await deleteEntries(selectedIds);
    setDeleteOpen(false);
    onClear();
  };

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 64, // above bottom nav
          left: 0,
          right: 0,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          px: 2,
          py: 1.5,
          zIndex: (theme) => theme.zIndex.appBar,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <IconButton size="small" onClick={onClear} sx={{ color: 'inherit' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
          {count} selected
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<LocalOfferOutlinedIcon />}
            onClick={() => setTagOpen(true)}
            sx={{ color: 'inherit' }}
          >
            Tag
          </Button>
          <Button
            size="small"
            startIcon={<SourceOutlinedIcon />}
            onClick={() => setSourceOpen(true)}
            sx={{ color: 'inherit' }}
          >
            Source
          </Button>
          <Button
            size="small"
            startIcon={<StarOutlineIcon />}
            onClick={() => setRateOpen(true)}
            sx={{ color: 'inherit' }}
          >
            Rate
          </Button>
          <Button
            size="small"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => void backfill.start(selectedIds)}
            sx={{ color: 'inherit' }}
          >
            Back-fill
          </Button>
          <Button
            size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setDeleteOpen(true)}
            sx={{ color: 'inherit' }}
          >
            Delete
          </Button>
        </Stack>
      </Box>

      {/* Tag dialog — adds every entered tag to each selected entry's
          existing tags; nothing is removed or replaced. */}
      <Dialog open={tagOpen} onClose={() => setTagOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add tags to {count} {count === 1 ? 'entry' : 'entries'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TagInput value={tagValues} onChange={setTagValues} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTag} disabled={tagValues.length === 0}>Add tags</Button>
        </DialogActions>
      </Dialog>

      {/* Source dialog — sets (overwrites) the same source on every
          selected entry, regardless of media type. Free-solo, with
          suggestions drawn from every source already saved anywhere in
          the library (same list that powers the Source filter chip). */}
      <Dialog open={sourceOpen} onClose={() => setSourceOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Set source for {count} {count === 1 ? 'entry' : 'entries'}</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            autoFocus
            options={availableSources}
            value={sourceValue}
            onInputChange={(_, newValue) => setSourceValue(newValue)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            renderInput={(params) => (
              <TextField {...params} label="Source" placeholder="e.g. Netflix, Humble Bundle…" sx={{ mt: 1 }} />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSource} disabled={!sourceValue.trim()}>Set source</Button>
        </DialogActions>
      </Dialog>

      {/* Rate dialog */}
      <Dialog open={rateOpen} onClose={() => setRateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Rate {count} {count === 1 ? 'entry' : 'entries'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography textAlign="center" variant="h5" fontWeight={700}>
              {rateValue.toFixed(1)}
            </Typography>
            <Slider
              value={rateValue}
              onChange={(_, v) => setRateValue(v as number)}
              min={0} max={10} step={0.5}
              marks={[0,2,4,6,8,10].map((v) => ({ value: v, label: String(v) }))}
              valueLabelDisplay="auto"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRate}>Apply rating</Button>
        </DialogActions>
      </Dialog>

      {/* Back-fill dialog — Film/TV only. State and async work live in
          useBackfillFlow (started above from the button's onClick);
          this dialog only renders it. onClose after 'done' also clears
          the selection, same as every other bulk action here. */}
      <BackfillDialog
        open={backfill.phase !== 'idle'}
        phase={backfill.phase}
        matches={backfill.matches}
        progress={backfill.progress}
        summary={backfill.summary}
        onPickCandidate={backfill.pickCandidate}
        onSkip={backfill.skipEntry}
        onApply={() => void backfill.applyAll()}
        onClose={() => {
          const finishing = backfill.phase === 'done';
          backfill.reset();
          if (finishing) onClear();
        }}
      />

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete {count} {count === 1 ? 'entry' : 'entries'}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes {count === 1 ? 'this entry' : `these ${count} entries`} from
            your library. This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
