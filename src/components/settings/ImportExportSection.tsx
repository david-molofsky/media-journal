import { useRef, useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import dayjs from 'dayjs';
import {
  exportLibrary,
  importLibrary,
} from '@/services/importExport/importExportService';
import { downloadJson } from '@/utils/downloadJson';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';

/**
 * Import / Export — the application's backup mechanism (PRD section
 * 5; UI & UX Specification section 9).
 */
export function ImportExportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const payload = await exportLibrary();
      downloadJson(payload, `media-journal-${dayjs().format('YYYY-MM-DD')}.json`);
      setStatus({ type: 'success', message: 'Journal exported.' });
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
      const parsed = JSON.parse(text);
      const result = await importLibrary(parsed);
      const skippedNote = result.skipped > 0 ? `, skipped ${result.skipped}` : '';
      setStatus({
        type: 'success',
        message: `Imported ${result.imported} ${result.imported === 1 ? 'entry' : 'entries'}${skippedNote}.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : "Couldn't read that file.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <CollapsibleSection title="Import and export" icon={DownloadOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Export your journal as a JSON file, or restore from a previous export. This is
        your backup — there's no cloud copy in version 1.
      </Typography>
      <Stack direction="row" spacing={2}>
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
            if (file) {
              void handleImportFile(file);
            }
          }}
        />
      </Stack>
      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </CollapsibleSection>
  );
}
