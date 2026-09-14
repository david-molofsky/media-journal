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
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import GoogleIcon from '@mui/icons-material/Google';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import dayjs from 'dayjs';
import {
  signInToDrive,
  signOutOfDrive,
  exportToGoogleDrive,
  listDriveExports,
  downloadDriveExport,
  type DriveExportFile,
} from '@/services/googleDrive/googleDriveService';
import { db } from '@/services/database/db';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
import { useDriveConnected } from '@/hooks/useDriveConnected';
import { SETTINGS_KEYS } from '@/models';
import {
  importLibrary,
  inspectLibraryImport,
  type ImportPreview,
  type RestoreMode,
} from '@/services/importExport/importExportService';
import { downloadPreRestoreBackup } from '@/services/importExport/restoreSafetyService';
import { RestoreBackupDialog } from '@/components/settings/RestoreBackupDialog';
import {
  clearAutomaticBackupFailure,
  isAutomaticBackupStale,
  recordAutomaticBackupFailure,
  recordAutomaticBackupSuccess,
} from '@/services/googleDrive/backupHealthService';

interface PendingDriveImport {
  raw: unknown;
  preview: ImportPreview;
  sourceName: string;
}

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
  // Reactive connection state — re-checks whenever the token row changes.
  const connected = useDriveConnected();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveExportFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingDriveImport | null>(null);

  // Automatic daily backup — see src/hooks/useAutoBackup.ts for the
  // watcher that actually triggers backups; this section only owns
  // the toggle, its confirmation, and the "last run" status line.
  const [autoBackupEnabled, setAutoBackupEnabled] = useBooleanSetting(
    SETTINGS_KEYS.autoBackupEnabled,
    false,
  );
  const [autoBackupConfirmOpen, setAutoBackupConfirmOpen] = useState(false);
  const lastAutoBackupAt = useLiveQuery(async () => {
    const record = await db.appSettings.get(SETTINGS_KEYS.lastAutoBackupAt);
    return (record?.value as string) ?? null;
  }, []);
  const lastAutoBackupError = useLiveQuery(async () => {
    const record = await db.appSettings.get(SETTINGS_KEYS.lastAutoBackupError);
    return (record?.value as string) ?? null;
  }, []);

  const handleAutoBackupToggle = (checked: boolean) => {
    if (checked) {
      setAutoBackupConfirmOpen(true);
    } else {
      setAutoBackupEnabled(false);
    }
  };

  const handleConfirmAutoBackup = () => {
    setAutoBackupConfirmOpen(false);
    setAutoBackupEnabled(true);
    void run(async () => {
      try {
        const fileName = await exportToGoogleDrive();
        await recordAutomaticBackupSuccess();
        setStatus({
          type: 'success',
          message: `Automatic backup enabled and verified with "${fileName}".`,
        });
      } catch (error) {
        await recordAutomaticBackupFailure(error);
        throw error;
      }
    });
  };

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
      setAutoBackupEnabled(false);
      await clearAutomaticBackupFailure();
      setStatus(null);
    });

  const handleExport = () =>
    run(async () => {
      const fileName = await exportToGoogleDrive();
      if (autoBackupEnabled) {
        await recordAutomaticBackupSuccess();
      } else {
        await clearAutomaticBackupFailure();
      }
      setStatus({
        type: 'success',
        message: `Saved as "${fileName}" in your Media Journal Drive folder.`,
      });
    });

  const automaticBackupOverdue =
    autoBackupEnabled &&
    !busy &&
    !lastAutoBackupError &&
    lastAutoBackupAt !== undefined &&
    isAutomaticBackupStale(lastAutoBackupAt);

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
      const raw = await downloadDriveExport(file.id);
      const preview = await inspectLibraryImport(raw);
      setPendingImport({ raw, preview, sourceName: file.name });
    });
  };

  const handleRestore = async (mode: RestoreMode) => {
    if (!pendingImport) return;

    await run(async () => {
      const sourceName = pendingImport.sourceName;
      const safetyCopyName =
        mode === 'replace' ? await downloadPreRestoreBackup() : null;
      const result = await importLibrary(pendingImport.raw, mode);
      const skippedNote =
        result.skipped > 0 ? ` ${result.skipped} invalid entries were skipped.` : '';

      setPendingImport(null);
      setStatus({
        type: 'success',
        message:
          `${mode === 'replace' ? 'Replaced' : 'Merged'} journal with ` +
          `${result.imported} ${result.imported === 1 ? 'entry' : 'entries'} ` +
          `from "${sourceName}".` +
          skippedNote +
          (safetyCopyName
            ? ` Your previous journal was downloaded as "${safetyCopyName}".`
            : ''),
      });
    });
  };

  return (
    <CollapsibleSection title="Google Drive" icon={GoogleIcon}>
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
            Your library exports are saved to a <strong>Media Journal</strong> folder in
            your Drive. Exporting today overwrites any previous export from today.
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              startIcon={
                busy ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CloudUploadOutlinedIcon />
                )
              }
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

          <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Automatic daily backup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Backs up to Drive at 23:59 each day this device is on, or as soon as
                  it's next opened.
                </Typography>
              </Box>
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Switch
                    checked={autoBackupEnabled}
                    onChange={(e) => handleAutoBackupToggle(e.target.checked)}
                  />
                }
                label=""
              />
            </Stack>

            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Only enable this on one device. Turning it on elsewhere too can cause
              backups to overwrite each other unpredictably.
            </Alert>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Last successful automatic backup:{' '}
              {lastAutoBackupAt
                ? dayjs(lastAutoBackupAt).format('D MMM YYYY, HH:mm')
                : 'never'}
            </Typography>

            {autoBackupEnabled && lastAutoBackupError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                Automatic backup failed: {lastAutoBackupError} Use “Export to Drive”
                above to retry now; a successful backup will clear this warning.
              </Alert>
            )}

            {automaticBackupOverdue && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                Automatic backup has not completed in the last 48 hours. Use “Export to
                Drive” above to protect the latest changes now.
              </Alert>
            )}
          </Box>
        </>
      )}

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {/* Import file picker */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        fullWidth
        maxWidth="xs"
      >
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

      {/* Automatic daily backup confirmation */}
      <Dialog
        open={autoBackupConfirmOpen}
        onClose={() => setAutoBackupConfirmOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Enable automatic daily backup?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Media Journal will create the first backup now, then this device will back
            up your library every day at 23:59.
          </Typography>
          <Alert severity="warning">
            Enable this on one device only, to avoid backups overwriting each other.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoBackupConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmAutoBackup} variant="contained">
            Enable
          </Button>
        </DialogActions>
      </Dialog>

      <RestoreBackupDialog
        preview={pendingImport?.preview ?? null}
        sourceName={pendingImport?.sourceName ?? ''}
        busy={busy}
        onCancel={() => setPendingImport(null)}
        onRestore={(mode) => void handleRestore(mode)}
      />
    </CollapsibleSection>
  );
}
