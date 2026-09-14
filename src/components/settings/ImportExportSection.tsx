import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import dayjs from 'dayjs';
import {
  exportLibrary,
  importLibrary,
  inspectLibraryImport,
  type ImportPreview,
  type RestoreMode,
} from '@/services/importExport/importExportService';
import { downloadJson } from '@/utils/downloadJson';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { RestoreBackupDialog } from '@/components/settings/RestoreBackupDialog';

interface PendingImport {
  raw: unknown;
  preview: ImportPreview;
  sourceName: string;
}

/**
 * Manual JSON backup and restore. Files are validated and previewed
 * before the user chooses Merge or Replace.
 */
export function ImportExportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setStatus(null);

    try {
      const payload = await exportLibrary();
      downloadJson(payload, `media-journal-${dayjs().format('YYYY-MM-DD')}.json`);
      setStatus({ type: 'success', message: 'Complete journal backup exported.' });
    } catch {
      setStatus({ type: 'error', message: "Couldn't export your journal. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    setStatus(null);

    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const preview = inspectLibraryImport(raw);
      setPendingImport({ raw, preview, sourceName: file.name });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : "Couldn't read that file.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (mode: RestoreMode) => {
    if (!pendingImport) return;

    setBusy(true);
    setStatus(null);

    try {
      const result = await importLibrary(pendingImport.raw, mode);
      const skippedNote =
        result.skipped > 0 ? ` ${result.skipped} invalid entries were skipped.` : '';

      setPendingImport(null);
      setStatus({
        type: 'success',
        message:
          `${mode === 'replace' ? 'Replaced' : 'Merged'} journal with ` +
          `${result.imported} ${result.imported === 1 ? 'entry' : 'entries'}, ` +
          `${result.mediaTypesImported} media types and ` +
          `${result.podcastSubscriptionsImported} podcast subscriptions.` +
          skippedNote,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : "Couldn't restore that backup.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <CollapsibleSection title="Import and export" icon={DownloadOutlinedIcon}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Download a complete, portable backup of your journal, or restore a JSON
          backup. Connection credentials and device-only settings are never included.
        </Typography>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            onClick={handleExport}
            disabled={busy}
          >
            Export JSON
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadOutlinedIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleImportFile(file);
            }}
          />
        </Stack>

        {status && (
          <Alert severity={status.type} sx={{ mt: 2 }} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        )}
      </CollapsibleSection>

      <RestoreBackupDialog
        preview={pendingImport?.preview ?? null}
        sourceName={pendingImport?.sourceName ?? ''}
        busy={busy}
        onCancel={() => setPendingImport(null)}
        onRestore={(mode) => void handleRestore(mode)}
      />
    </>
  );
}
