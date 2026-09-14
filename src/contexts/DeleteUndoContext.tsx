import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import {
  deleteEntriesWithSnapshot,
  restoreDeletedEntries,
} from '@/services/database/entryService';
import type { MediaEntry } from '@/models';

interface DeleteUndoContextValue {
  deleteWithUndo: (entryIds: string[]) => Promise<number>;
}

const DeleteUndoContext = createContext<DeleteUndoContextValue | null>(null);

export function DeleteUndoProvider({ children }: { children: ReactNode }) {
  const [pendingEntries, setPendingEntries] = useState<MediaEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const deleteWithUndo = useCallback(async (entryIds: string[]) => {
    const deleted = await deleteEntriesWithSnapshot(entryIds);
    setFeedback(null);
    setPendingEntries(deleted);
    return deleted.length;
  }, []);

  const undo = useCallback(async () => {
    if (pendingEntries.length === 0 || undoing) return;

    setUndoing(true);
    try {
      await restoreDeletedEntries(pendingEntries);
      const count = pendingEntries.length;
      setPendingEntries([]);
      setFeedback(
        count === 1 ? 'Entry restored.' : `${count} entries restored.`,
      );
    } catch {
      setFeedback('Could not restore the deleted entries. Please try Undo again.');
    } finally {
      setUndoing(false);
    }
  }, [pendingEntries, undoing]);

  const value = useMemo(() => ({ deleteWithUndo }), [deleteWithUndo]);
  const count = pendingEntries.length;

  return (
    <DeleteUndoContext.Provider value={value}>
      {children}

      <Snackbar
        open={count > 0}
        message={
          count === 1
            ? `Deleted “${pendingEntries[0]?.title ?? 'entry'}”.`
            : `Deleted ${count} entries.`
        }
        autoHideDuration={10_000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway' && !undoing) setPendingEntries([]);
        }}
        action={
          <Button color="secondary" size="small" onClick={() => void undo()}>
            {undoing ? 'Restoring…' : 'Undo'}
          </Button>
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, sm: 24 } }}
      />

      <Snackbar
        open={feedback !== null}
        autoHideDuration={4_000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, sm: 24 } }}
      >
        <Alert
          severity={feedback?.startsWith('Could not') ? 'error' : 'success'}
          onClose={() => setFeedback(null)}
        >
          {feedback}
        </Alert>
      </Snackbar>
    </DeleteUndoContext.Provider>
  );
}

export function useDeleteUndo(): DeleteUndoContextValue {
  const context = useContext(DeleteUndoContext);
  if (!context) {
    throw new Error('useDeleteUndo must be used within DeleteUndoProvider');
  }
  return context;
}
