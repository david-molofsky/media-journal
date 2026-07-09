import { useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import { useGoodreadsImportFlow } from '@/hooks/useGoodreadsImportFlow';
import { GoodreadsImportDialog } from '@/components/settings/GoodreadsImportDialog';

/**
 * Settings > Import from Goodreads. Entry point only — all flow state
 * lives in useGoodreadsImportFlow, kicked off from this file input's
 * onChange (a plain event handler, not a useEffect).
 */
export function GoodreadsImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useGoodreadsImportFlow();

  const handleChoose = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (file) void flow.start(file);
  };

  const dialogOpen = flow.phase !== 'idle';

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Import from Goodreads
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload <code>goodreads_library_export.csv</code> (My Books &gt; Import and Export &gt;
        Export Library, on goodreads.com — desktop only). Read, currently-reading and to-read
        shelves all import as Book or Audiobook entries — re-running this later only imports
        what's new.
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<UploadOutlinedIcon />} onClick={handleChoose}>
          Choose goodreads_library_export.csv
        </Button>
      </Stack>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={handleFileChange}
      />

      <GoodreadsImportDialog
        open={dialogOpen}
        phase={flow.phase}
        rows={flow.rows}
        progress={flow.progress}
        summary={flow.summary}
        onSetCompletedDate={flow.setCompletedDate}
        onSkip={flow.skipEntry}
        onApply={() => void flow.applyAll()}
        onClose={flow.reset}
      />
    </Box>
  );
}
