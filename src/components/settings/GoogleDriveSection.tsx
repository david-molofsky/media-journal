import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import GoogleIcon from '@mui/icons-material/Google';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import dayjs from 'dayjs';
import {
  signInToDrive,
  signOutOfDrive,
  exportToGoogleDrive,
  listDriveExports,
  importFromDriveFile,
  type DriveExportFile,
} from '@/services/googleDrive/googleDriveService';
import { db } from '@/services/database/db';

/**
 * Google Drive section in Settings. Handles:
 *   • Connecting / disconnecting via GIS OAuth2
 *   • Exporting the library directly to a "Media Journal" Drive folder
 *   • Importing from a previous Drive export (file picker dialog)
 *
 * The `drive.file` scope means this app can only see files it created
 * — it cannot read or write anything else in the user's Drive.
 */
export function GoogleDriveSection() {
  const TOKEN_KEY = 'googleDriveToken';

  // Reactive connection state — re-checks whenever the token row changes.
  const connected = useLiveQuery(async () => {
    const record = await db.appSettings.get(TOKEN_KEY);
    return record !== undefined;
  }, []);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveExportFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = () =>
    run(async () => {
      await signInToDrive();
      setStatus({ type: 'success', message: 'Connected to Google Drive.' });
    });

  const handleDisconnect = () =>
    run(async () => {
      await signOutOfDrive();
      setStatus(null);
    });

  const handleExport = () =>
    run(async () => {
      const fileName = await exportToGoogleDrive();
      setStatus({ type: 'success', message: `Saved as "${fileName}" in your Media Journal Drive folder.` });
    });

  const handleOpenImport = async () => {
    setImportOpen(true);
    setLoadingFiles(true);
    setDriveFiles([]);
    try {
      const files = await listDriveExports();
      setDriveFiles(files);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not list Drive files.',
      });
      setImportOpen(false);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleImportFile = async (file: DriveExportFile) => {
    setImportOpen(false);
    await run(async () => {
      const result = await importFromDriveFile(file.id);
      const skipped = result.skipped > 0 ? `, skipped ${result.skipped}` : '';
      setStatus({
        type: 'success',
        message: `Imported ${result.imported} ${result.imported === 1 ? 'entry' : 'entries'} from "${file.name}"${skipped}.`,
      });
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <GoogleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2" color="text.secondary">
          Google Drive
        </Typography>
      </Stack>

      {!connected ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect Google Drive to export and import your library directly — no manual
            file downloads needed. Only files this app creates are accessible.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={handleConnect}
            disabled={busy}
          >
            Connect to Google Drive
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your library exports are saved to a <strong>Media Journal</strong> folder in your
            Drive. Exporting today overwrites any previous export from today.
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CloudUploadOutlinedIcon />}
              onClick={handleExport}
              disabled={busy}
            >
              Export to Drive
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudDownloadOutlinedIcon />}
              onClick={handleOpenImport}
              disabled={busy}
            >
              Import from Drive
            </Button>
            <Button
              startIcon={<LogoutOutlinedIcon />}
              onClick={handleDisconnect}
              disabled={busy}
              color="inherit"
              size="small"
              sx={{ ml: 'auto' }}
            >
              Disconnect
            </Button>
          </Stack>
        </>
      )}

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {/* Import file picker */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Import from Google Drive</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {loadingFiles ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : driveFiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No Media Journal exports found in your Drive.
            </Typography>
          ) : (
            <List disablePadding>
              {driveFiles.map((file) => (
                <ListItem key={file.id} disablePadding divider>
                  <ListItemButton onClick={() => void handleImportFile(file)}>
                    <ListItemText
                      primary={file.name}
                      secondary={`Last modified ${dayjs(file.modifiedTime).format('D MMM YYYY, HH:mm')}${file.size ? ` · ${Math.round(Number(file.size) / 1024)} KB` : ''}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
