import { useRef } from 'react';
import { useNetflixImportFlow } from '@/hooks/useNetflixImportFlow';
import { StreamingImportDialog } from '@/components/settings/StreamingImportDialog';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';

interface NetflixImportSectionProps {
  open: boolean;
  onCloseInstructions: () => void;
}

/**
 * Import from Netflix. Same wrapper shape as LetterboxdImportSection —
 * renders no visible row of its own (ImportSourcesSection/
 * WelcomeImportSources own that), just the instructions dialog, file
 * input, and the flow dialog. Uses the shared StreamingImportDialog
 * (also used by AmazonPrimeImportSection) rather than a bespoke one.
 */
export function NetflixImportSection({ open, onCloseInstructions }: NetflixImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useNetflixImportFlow();

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
        title="Import from Netflix"
        description={
          <>
            In Netflix, go to Account &gt; Profile &amp; Parental Controls &gt; Viewing Activity
            &gt; Download all — this downloads <code>NetflixViewingHistory.csv</code>. Every
            movie and show becomes a Film or TV entry, matched against TMDB. Re-running this
            later only imports what's new.
          </>
        }
        buttonLabel="Choose NetflixViewingHistory.csv"
        onChoose={handleChoose}
      />
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />

      <StreamingImportDialog
        open={flowDialogOpen}
        title="Import from Netflix"
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
