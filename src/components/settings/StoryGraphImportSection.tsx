import { useRef } from 'react';
import { useStoryGraphImportFlow } from '@/hooks/useStoryGraphImportFlow';
import { StoryGraphImportDialog } from '@/components/settings/StoryGraphImportDialog';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';

interface StoryGraphImportSectionProps {
  /** Controlled by the row in ImportSourcesSection, same convention as
   * the other three import sources. */
  open: boolean;
  onCloseInstructions: () => void;
}

/**
 * Import from StoryGraph. All flow state lives in
 * useStoryGraphImportFlow, kicked off from the file input's onChange (a
 * plain event handler, not a useEffect). Renders no visible row of its
 * own — that's ImportSourcesSection's compact list; this just owns the
 * instructions dialog, file input, and the import flow dialog.
 */
export function StoryGraphImportSection({ open, onCloseInstructions }: StoryGraphImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useStoryGraphImportFlow();

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
        title="Import from StoryGraph"
        description={
          <>
            Upload your library export CSV (Manage Account &gt; Manage Your Data &gt; "Export
            StoryGraph Library", on app.thestorygraph.com). Read, currently-reading, to-read and
            did-not-finish books all import — rereads with multiple logged dates become separate
            entries, and moods/pace/content warnings/tags all come through as tags.
          </>
        }
        buttonLabel="Choose CSV"
        onChoose={handleChoose}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={handleFileChange}
      />

      <StoryGraphImportDialog
        open={flowDialogOpen}
        phase={flow.phase}
        rows={flow.rows}
        progress={flow.progress}
        summary={flow.summary}
        onSetCompletedDate={flow.setCompletedDate}
        onSkip={flow.skipEntry}
        onSetIncluded={flow.setIncluded}
        onSetAllIncluded={flow.setAllIncluded}
        onApply={() => void flow.applyAll()}
        onClose={flow.reset}
      />
    </>
  );
}
