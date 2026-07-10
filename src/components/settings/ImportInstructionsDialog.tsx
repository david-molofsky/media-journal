import type { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';

interface ImportInstructionsDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  buttonLabel: string;
  onChoose: () => void;
  onClose: () => void;
}

/**
 * The small "here's where to export from, here's what happens to your
 * data" step shown before the file picker opens — each import source's
 * compact row in ImportSourcesSection opens this rather than jumping
 * straight to the file picker (see chat: the instructions were worth
 * keeping, just moved from an always-visible paragraph into an
 * on-demand step).
 */
export function ImportInstructionsDialog({
  open,
  title,
  description,
  buttonLabel,
  onChoose,
  onClose,
}: ImportInstructionsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<UploadOutlinedIcon />} onClick={onChoose}>
          {buttonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
