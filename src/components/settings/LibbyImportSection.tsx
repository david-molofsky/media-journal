import { useRef } from 'react';
import { useAllMediaTypes } from '@/hooks/useAllMediaTypes';
import { useLibbyImportFlow } from '@/hooks/useLibbyImportFlow';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';
import { LibbyImportDialog } from '@/components/settings/LibbyImportDialog';

interface LibbyImportSectionProps {
  open: boolean;
  onCloseInstructions: () => void;
}

export function LibbyImportSection({
  open,
  onCloseInstructions,
}: LibbyImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useLibbyImportFlow();
  const mediaTypes = useAllMediaTypes() ?? [];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onCloseInstructions();
      void flow.start(file);
    }
  };

  return (
    <>
      <ImportInstructionsDialog
        open={open}
        onClose={onCloseInstructions}
        title="Import from Libby"
        description={
          <>
            Choose a Libby Timeline JSON export. Titles are grouped by ISBN, loan dates
            are kept as start dates, and you can review the media type and status before
            importing. Re-importing the same file skips existing titles; new loan dates
            are added to the existing Libby entry.
          </>
        }
        buttonLabel="Choose JSON"
        onChoose={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleFileChange}
      />
      <LibbyImportDialog
        open={flow.phase !== 'idle'}
        phase={flow.phase}
        rows={flow.rows}
        mediaTypes={mediaTypes}
        progress={flow.progress}
        summary={flow.summary}
        error={flow.error}
        onSetEntryStatus={flow.setEntryStatus}
        onSetCompletedDate={flow.setCompletedDate}
        onSetMediaType={flow.setMediaType}
        onSetIncluded={flow.setIncluded}
        onSetAllIncluded={flow.setAllIncluded}
        onApply={() => void flow.applyAll()}
        onClose={flow.reset}
      />
    </>
  );
}
