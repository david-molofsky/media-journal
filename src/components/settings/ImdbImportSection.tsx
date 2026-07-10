import { useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import { useImdbImportFlow } from '@/hooks/useImdbImportFlow';
import { ImdbImportDialog } from '@/components/settings/ImdbImportDialog';

/**
 * Settings > Import from IMDb. Entry point only — all flow state lives
 * in useImdbImportFlow, kicked off from this file input's onChange (a
 * plain event handler, not a useEffect).
 */
export function ImdbImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useImdbImportFlow();

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
        Import from IMDb
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload your ratings export (account &gt; Your Ratings &gt; Export, on imdb.com — desktop
        only). Movies import straight away; TV shows get a quick per-show prompt asking which
        season(s) to log, since IMDb rates episodes rather than seasons.
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<UploadOutlinedIcon />} onClick={handleChoose}>
          Choose ratings export CSV
        </Button>
      </Stack>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={handleFileChange}
      />

      <ImdbImportDialog
        open={dialogOpen}
        phase={flow.phase}
        matchProgress={flow.matchProgress}
        movies={flow.movies}
        showGroups={flow.showGroups}
        skipped={flow.skipped}
        showIndex={flow.showIndex}
        selections={flow.selections}
        skippedShowIds={flow.skippedShowIds}
        importProgress={flow.importProgress}
        summary={flow.summary}
        onBeginShowPrompts={() => void flow.beginShowPrompts()}
        onToggleSeason={flow.toggleSeason}
        onFinishShow={(showId, skip) => void flow.finishShow(showId, skip)}
        onClose={flow.reset}
      />
    </Box>
  );
}
