import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { RatingInput } from '@/components/forms/RatingInput';

interface MarkFinishedDialogProps {
  /** null/undefined closes the dialog — same "open via presence of a
   * target" convention as LibraryPage originally used. */
  entryTitle: string | undefined;
  open: boolean;
  date: string;
  onDateChange: (value: string) => void;
  rating: number | undefined;
  onRatingChange: (value: number | undefined) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Combined Completed Date + Rating confirmation shown by every
 * "Mark finished" quick action (Library card menu, Entry Detail page —
 * see chat, Aug 2026). Extracted out of LibraryPage.tsx so both call
 * sites share one implementation rather than drifting apart.
 */
export function MarkFinishedDialog({
  entryTitle,
  open,
  date,
  onDateChange,
  rating,
  onRatingChange,
  onCancel,
  onConfirm,
}: MarkFinishedDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Mark "{entryTitle}" finished?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Confirm the completed date and add a rating if you have one.
        </Typography>
        <TextField
          label="Completed date"
          type="date"
          fullWidth
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mb: 2 }}
        />
        <RatingInput value={rating} onChange={onRatingChange} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Mark finished
        </Button>
      </DialogActions>
    </Dialog>
  );
}
