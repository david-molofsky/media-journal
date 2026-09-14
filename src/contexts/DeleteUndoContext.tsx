import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import {
  deleteEntriesWithSnapshot,
  getEntriesSnapshot,
  restoreEntriesSnapshot,
} from '@/services/database/entryService';
import type { MediaEntry } from '@/models';
import { JOURNAL_REPLACED_EVENT } from '@/services/dataSafety/journalRestoreEvents';

interface DeleteUndoContextValue {
  deleteWithUndo: (entryIds: string[]) => Promise<number>;
  runWithUndo: (
    entryIds: string[],
    action: () => Promise<void>,
    message: string,
  ) => Promise<number>;
}

interface PendingUndo {
  entries: MediaEntry[];
  message: string;
  successMessage: string;
}

const DeleteUndoContext = createContext<DeleteUndoContextValue | null>(null);

export function DeleteUndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const clearTransientUndo = () => {
      setPending(null);
      setFeedback(null);
    };

    window.addEventListener(JOURNAL_REPLACED_EVENT, clearTransientUndo);
    return () =>
      window.removeEventListener(JOURNAL_REPLACED_EVENT, clearTransientUndo);
  }, []);

  const deleteWithUndo = useCallback(async (entryIds: string[]) => {
    const deleted = await deleteEntriesWithSnapshot(entryIds);
    const count = deleted.length;
    setFeedback(null);
    setPending(
      count === 0
        ? null
        : {
            entries: deleted,
            message:
              count === 1
                ? `Deleted “${deleted[0]?.title ?? 'entry'}”.`
                : `Deleted ${count} entries.`,
            successMessage:
              count === 1 ? 'Entry restored.' : `${count} entries restored.`,
          },
    );
    return count;
  }, []);

  const runWithUndo = useCallback(
    async (
      entryIds: string[],
      action: () => Promise<void>,
      message: string,
    ) => {
      const snapshot = await getEntriesSnapshot(entryIds);

      try {
        await action();
      } catch (error) {
        // Bulk helpers normally commit atomically. If a future helper
        // partially changes data before throwing, restore the captured
        // state before surfacing the original failure.
        await restoreEntriesSnapshot(snapshot);
        throw error;
      }

      setFeedback(null);
      setPending(
        snapshot.length === 0
          ? null
          : {
              entries: snapshot,
              message,
              successMessage: 'Changes undone.',
            },
      );
      return snapshot.length;
    },
    [],
  );

  const undo = useCallback(async () => {
    if (!pending || undoing) return;

    setUndoing(true);
    try {
      await restoreEntriesSnapshot(pending.entries);
      const successMessage = pending.successMessage;
      setPending(null);
      setFeedback(successMessage);
    } catch {
      setFeedback('Could not undo the change. Please try Undo again.');
    } finally {
      setUndoing(false);
    }
  }, [pending, undoing]);

  const value = useMemo(
    () => ({ deleteWithUndo, runWithUndo }),
    [deleteWithUndo, runWithUndo],
  );

  return (
    <DeleteUndoContext.Provider value={value}>
      {children}

      <Snackbar
        open={pending !== null}
        message={pending?.message ?? ''}
        autoHideDuration={10_000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway' && !undoing) setPending(null);
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
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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
