import { useRef } from 'react';
import Link from '@mui/material/Link';
import { useAmazonPrimeImportFlow } from '@/hooks/useAmazonPrimeImportFlow';
import { StreamingImportDialog } from '@/components/settings/StreamingImportDialog';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';

interface AmazonPrimeImportSectionProps {
  open: boolean;
  onCloseInstructions: () => void;
}

const EXPORTER_TOOL_URL =
  'https://github.com/caret-collective/watch-history-exporter-for-amazon-prime-video';

/**
 * Import from Amazon Prime Video. Amazon has no official watch-history
 * export, so — unlike every other *ImportSection — the instructions
 * here point to a free, open-source third-party tool (public domain,
 * by John Goodliff) that the person runs themselves on
 * primevideo.com/settings/watch-history to produce a CSV, which is
 * then uploaded the same way as any other CSV import. Otherwise
 * identical wrapper shape to NetflixImportSection, sharing the same
 * StreamingImportDialog for the review/tick step.
 */
export function AmazonPrimeImportSection({ open, onCloseInstructions }: AmazonPrimeImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useAmazonPrimeImportFlow();

  const handleChoose = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onCloseInstructions();
      void flow.start(file);
    }
  };

  const flowDialogOpen = flow.phase !== 'idle';

  return (
    <>
      <ImportInstructionsDialog
        open={open}
        onClose={onCloseInstructions}
        title="Import from Amazon Prime Video"
        description={
          <>
            Amazon doesn't provide a built-in watch-history export, so this uses the free,
            open-source{' '}
            <Link href={EXPORTER_TOOL_URL} target="_blank" rel="noopener noreferrer">
              Watch History Exporter for Amazon Prime Video
            </Link>{' '}
            by John Goodliff. Open{' '}
            <Link href="https://www.primevideo.com/settings/watch-history" target="_blank" rel="noopener noreferrer">
              primevideo.com/settings/watch-history
            </Link>
            , follow the tool's instructions to download a CSV, then upload it here. Every movie
            and show becomes a Film or TV entry, matched against TMDB.
          </>
        }
        buttonLabel="Choose CSV"
        onChoose={handleChoose}
      />
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />

      <StreamingImportDialog
        open={flowDialogOpen}
        title="Import from Amazon Prime Video"
        phase={flow.phase}
        items={flow.items}
        progress={flow.progress}
        summary={flow.summary}
        onPickMovieCandidate={flow.pickMovieCandidate}
        onSkipMovie={flow.skipMovie}
        onSetMovieIncluded={flow.setMovieIncluded}
        onPickShowCandidate={flow.pickShowCandidate}
        onToggleSeason={flow.toggleSeason}
        onSetAllIncluded={flow.setAllIncluded}
        onApply={() => void flow.applyAll()}
        onClose={flow.reset}
      />
    </>
  );
}
