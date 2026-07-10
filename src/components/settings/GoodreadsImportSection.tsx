import { useRef } from 'react';
import { useGoodreadsImportFlow } from '@/hooks/useGoodreadsImportFlow';
import { GoodreadsImportDialog } from '@/components/settings/GoodreadsImportDialog';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';

interface GoodreadsImportSectionProps {
  /** Controlled by the row in ImportSourcesSection, rather than owned
   * here — lets one shared list trigger any of the three sources'
   * instructions dialog. */
  open: boolean;
  onCloseInstructions: () => void;
}

/**
 * Import from Goodreads. All flow state lives in
 * useGoodreadsImportFlow, kicked off from the file input's onChange (a
 * plain event handler, not a useEffect). Renders no visible row of its
 * own — that's ImportSourcesSection's compact list; this just owns the
 * instructions dialog, file input, and the import flow dialog.
 */
export function GoodreadsImportSection({ open, onCloseInstructions }: GoodreadsImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useGoodreadsImportFlow();

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
        title="Import from Goodreads"
        description={
          <>
            Upload <code>goodreads_library_export.csv</code> (My Books &gt; Import and Export
            &gt; Export Library, on goodreads.com — desktop only). Read, currently-reading and
            to-read shelves all import as Book or Audiobook entries — re-running this later only
            imports what's new.
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

      <GoodreadsImportDialog
        open={flowDialogOpen}
        phase={flow.phase}
        selectedStatuses={flow.selectedStatuses}
        emptyReason={flow.emptyReason}
        rows={flow.rows}
        progress={flow.progress}
        summary={flow.summary}
        onToggleStatus={flow.toggleStatus}
        onConfirmShelves={() => void flow.confirmShelves()}
        onSetCompletedDate={flow.setCompletedDate}
        onSkip={flow.skipEntry}
        onApply={() => void flow.applyAll()}
        onClose={flow.reset}
      />
    </>
  );
}
