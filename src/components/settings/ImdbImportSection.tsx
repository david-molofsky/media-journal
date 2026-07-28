import { useRef } from 'react';
import { useImdbImportFlow } from '@/hooks/useImdbImportFlow';
import { ImdbImportDialog } from '@/components/settings/ImdbImportDialog';
import { ImportInstructionsDialog } from '@/components/settings/ImportInstructionsDialog';

interface ImdbImportSectionProps {
  /** Controlled by the row in ImportSourcesSection, rather than owned
   * here — lets one shared list trigger any of the three sources'
   * instructions dialog. */
  open: boolean;
  onCloseInstructions: () => void;
}

/**
 * Import from IMDb. All flow state lives in useImdbImportFlow, kicked
 * off from the file input's onChange (a plain event handler, not a
 * useEffect). Renders no visible row of its own — that's
 * ImportSourcesSection's compact list; this just owns the instructions
 * dialog, file input, and the import flow dialog.
 */
export function ImdbImportSection({ open, onCloseInstructions }: ImdbImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flow = useImdbImportFlow();

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
        title="Import from IMDb"
        description={
          <>
            Upload your ratings export (account &gt; Your Ratings &gt; Export, on imdb.com —
            desktop only). Movies import straight away; TV shows get a quick per-show prompt
            asking which season(s) to log, since IMDb rates episodes rather than seasons.
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

      <ImdbImportDialog
        open={flowDialogOpen}
        phase={flow.phase}
        matchProgress={flow.matchProgress}
        movies={flow.movies}
        showGroups={flow.showGroups}
        skipped={flow.skipped}
        showIndex={flow.showIndex}
        selections={flow.selections}
        skippedShowIds={flow.skippedShowIds}
        excludedMovies={flow.excludedMovies}
        importProgress={flow.importProgress}
        summary={flow.summary}
        onBeginShowPrompts={() => void flow.beginShowPrompts()}
        onToggleSeason={flow.toggleSeason}
        onToggleMovieIncluded={flow.toggleMovieIncluded}
        onSetAllMoviesIncluded={flow.setAllMoviesIncluded}
        onFinishShow={(showId, skip) => void flow.finishShow(showId, skip)}
        onClose={flow.reset}
      />
    </>
  );
}
