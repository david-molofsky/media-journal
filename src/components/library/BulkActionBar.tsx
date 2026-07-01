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
import Slider from '@mui/material/Slider';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { deleteEntries, bulkAddTag, bulkSetRating } from '@/services/database/entryService';

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
}

/**
 * Sticky action bar that appears at the bottom of the Library when one
 * or more entries are selected. Provides Tag, Rate and Delete actions
 * that apply to all selected entries simultaneously.
 */
export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState<number>(7);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const count = selectedIds.length;

  const handleTag = async () => {
    const trimmed = tagValue.trim().toLowerCase();
    if (trimmed) {
      await bulkAddTag(selectedIds, trimmed);
    }
    setTagOpen(false);
    setTagValue('');
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
            startIcon={<StarOutlineIcon />}
            onClick={() => setRateOpen(true)}
            sx={{ color: 'inherit' }}
          >
            Rate
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

      {/* Tag dialog */}
      <Dialog open={tagOpen} onClose={() => setTagOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add tag to {count} {count === 1 ? 'entry' : 'entries'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Tag"
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleTag(); }}
            helperText="Will be lowercased automatically"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTag} disabled={!tagValue.trim()}>Add tag</Button>
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
