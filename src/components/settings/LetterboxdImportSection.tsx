import { useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import { useLetterboxdImportFlow } from '@/hooks/useLetterboxdImportFlow';
import { LetterboxdImportDialog } from '@/components/settings/LetterboxdImportDialog';

/**
 * Settings > Import from Letterboxd. Entry point only — all flow state
 * lives in useLetterboxdImportFlow, kicked off from this file input's
 * onChange (a plain event handler, not a useEffect).
 */
export function LetterboxdImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useLetterboxdImportFlow();

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
        Import from Letterboxd
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload <code>diary.csv</code> from a Letterboxd data export (Settings &gt; Import
        &amp; Export &gt; Export your data, on letterboxd.com). Each viewing becomes a Film
        entry, matched against TMDB — re-running this later only imports what's new.
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<UploadOutlinedIcon />} onClick={handleChoose}>
          Choose diary.csv
        </Button>
      </Stack>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={handleFileChange}
      />

      <LetterboxdImportDialog
        open={dialogOpen}
        phase={flow.phase}
        matches={flow.matches}
        progress={flow.progress}
        summary={flow.summary}
        onPickCandidate={flow.pickCandidate}
        onSkip={flow.skipEntry}
        onSetImportAnyway={flow.setImportAnyway}
        onApply={() => void flow.applyAll()}
        onClose={flow.reset}
      />
    </Box>
  );
}
