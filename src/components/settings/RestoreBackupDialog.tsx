import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import type {
  ImportPreview,
  RestoreMode,
} from '@/services/importExport/importExportService';

interface RestoreBackupDialogProps {
  preview: ImportPreview | null;
  sourceName: string;
  busy: boolean;
  onCancel: () => void;
  onRestore: (mode: RestoreMode) => void;
}

export function RestoreBackupDialog({
  preview,
  sourceName,
  busy,
  onCancel,
  onRestore,
}: RestoreBackupDialogProps) {
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  useEffect(() => {
    setConfirmingReplace(false);
  }, [preview]);

  if (!preview) return null;

  const handleClose = () => {
    if (!busy) onCancel();
  };

  return (
    <Dialog open onClose={handleClose} fullWidth maxWidth="xs">
      {!confirmingReplace ? (
        <>
          <DialogTitle>Review backup</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Choose whether to merge this backup with the journal on this device or
              replace the journal completely.
            </DialogContentText>

            <Typography variant="body2" fontWeight={600}>
              {sourceName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Backup format v{preview.version}
              {preview.exportedAt
                ? ` · Created ${dayjs(preview.exportedAt).format('D MMM YYYY, HH:mm')}`
                : ''}
            </Typography>

            <List dense sx={{ mt: 1 }}>
              <ListItem disableGutters>
                <ListItemText primary="Entries" secondary={preview.entryCount} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary="Media types" secondary={preview.mediaTypeCount} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Podcast subscriptions"
                  secondary={preview.podcastSubscriptionCount}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Portable preferences"
                  secondary={preview.settingCount}
                />
              </ListItem>
            </List>

            <Stack spacing={1.5}>
              <Alert severity="info">
                Merge updates matching records and keeps anything else already on this
                device.
              </Alert>

              {preview.legacy && (
                <Alert severity="warning">
                  This is an older Version 1 backup. It can be merged, but it cannot
                  replace the journal because it does not contain media types or podcast
                  subscriptions.
                </Alert>
              )}

              {preview.skippedEntryCount > 0 && (
                <Alert severity="warning">
                  {preview.skippedEntryCount}{' '}
                  {preview.skippedEntryCount === 1 ? 'entry is' : 'entries are'} invalid
                  and will be skipped. Replace is disabled to protect the current
                  journal.
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => onRestore('merge')}
              disabled={busy}
              variant="outlined"
            >
              Merge
            </Button>
            <Button
              onClick={() => setConfirmingReplace(true)}
              disabled={busy || !preview.canReplace}
              color="error"
              variant="contained"
            >
              Replace
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>Replace this journal?</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              Entries, media types, podcast subscriptions and portable preferences on
              this device that are not in the backup will be permanently removed.
            </Alert>
            <DialogContentText>
              Connection credentials and device-only settings will remain unchanged.
              This operation cannot be undone unless you have another backup.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmingReplace(false)} disabled={busy}>
              Back
            </Button>
            <Button
              onClick={() => onRestore('replace')}
              disabled={busy}
              color="error"
              variant="contained"
            >
              Replace journal
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
