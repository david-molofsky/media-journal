import { useRef } from 'react';
import { useLetterboxdImportFlow } from '@/hooks/useLetterboxdImportFlow';
import { LetterboxdImportDialog } from '@/components/settings/LetterboxdImportDialog';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';

interface LetterboxdImportSectionProps {
  /** Controlled by the row in ImportSourcesSection, rather than owned
   * here — lets one shared list trigger any of the three sources'
   * instructions dialog. */
  open: boolean;
  onCloseInstructions: () => void;
}

/**
 * Import from Letterboxd. All flow state lives in
 * useLetterboxdImportFlow, kicked off from the file input's onChange (a
 * plain event handler, not a useEffect). Renders no visible row of its
 * own — that's ImportSourcesSection's compact list; this just owns the
 * instructions dialog, file input, and the import flow dialog.
 */
export function LetterboxdImportSection({ open, onCloseInstructions }: LetterboxdImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useLetterboxdImportFlow();

  const handleChoose = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
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
        title="Import from Letterboxd"
        description={
          <>
            Upload <code>diary.csv</code> from a Letterboxd data export (Settings &gt; Import
            &amp; Export &gt; Export your data, on letterboxd.com). Each viewing becomes a Film
            entry, matched against TMDB — re-running this later only imports what's new.
          </>
        }
        buttonLabel="Choose diary.csv"
        onChoose={handleChoose}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={handleFileChange}
      />

      <LetterboxdImportDialog
        open={flowDialogOpen}
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
    </>
  );
}
