import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Link as RouterLink } from 'react-router-dom';
import { db } from '@/services/database/db';
import {
  analyseDataHealth,
  type DuplicateGroup,
  type ValueVariation,
} from '@/services/dataQuality/dataQualityService';
import {
  mergeDuplicateEntries,
  normalizeEntryValues,
} from '@/services/dataQuality/dataQualityRepository';
import { editEntryPath, entryDetailPath } from '@/routes/paths';

const fieldLabel = { source: 'Source', genre: 'Genre', tag: 'Tag' } as const;

export function DataHealthSection() {
  const entries = useLiveQuery(() => db.mediaEntries.toArray(), []);
  const report = useMemo(() => analyseDataHealth(entries ?? []), [entries]);
  const [normalizing, setNormalizing] = useState<string | null>(null);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [merging, setMerging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const normalize = async (variation: ValueVariation) => {
    const key = `${variation.field}:${variation.canonical}`;
    setNormalizing(key);
    setMessage(null);
    try {
      const changed = await normalizeEntryValues(
        variation.field,
        variation.variants,
        variation.canonical,
      );
      setMessage(
        `Normalized ${changed} ${changed === 1 ? 'entry' : 'entries'} to “${variation.canonical}”.`,
      );
    } finally {
      setNormalizing(null);
    }
  };

  const mergeDuplicates = async () => {
    const keeper = mergeGroup?.entries[0];
    if (!mergeGroup || !keeper) return;
    setMerging(true);
    setMessage(null);
    try {
      await mergeDuplicateEntries(
        mergeGroup.entries.map(({ id }) => id),
        keeper.id,
      );
      setMessage(`Merged ${mergeGroup.entries.length} copies of “${keeper.title}”.`);
      setMergeGroup(null);
    } finally {
      setMerging(false);
    }
  };

  if (report.issueCount === 0) {
    return (
      <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
        No likely duplicates, inconsistent labels or incomplete completed entries found.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Review likely duplicates and incomplete records. Safe label changes can be applied
        across the whole journal in one transaction.
      </Typography>

      {message && <Alert severity="success">{message}</Alert>}

      {report.duplicates.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Likely duplicates ({report.duplicates.length})
          </Typography>
          <Stack divider={<Divider flexItem />}>
            {report.duplicates.map((group) => (
              <Box key={group.key} sx={{ py: 1.25 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" fontWeight={600}>
                    {group.entries[0]?.title}
                  </Typography>
                  <Chip size="small" label={`${group.entries.length} entries`} />
                  {group.repeatImportConflict && (
                    <Chip size="small" color="warning" label="Possible repeat import" />
                  )}
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 0.75 }} flexWrap="wrap">
                  {group.entries.map((entry, index) => (
                    <Link
                      key={entry.id}
                      component={RouterLink}
                      to={entryDetailPath(entry.id)}
                      variant="caption"
                    >
                      Review entry {index + 1}
                    </Link>
                  ))}
                  <Button size="small" onClick={() => setMergeGroup(group)}>
                    Merge copies
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {report.variations.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Labels to normalize ({report.variations.length})
          </Typography>
          <Stack divider={<Divider flexItem />}>
            {report.variations.map((variation) => {
              const key = `${variation.field}:${variation.canonical}`;
              return (
                <Stack
                  key={key}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{ py: 1.25 }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {fieldLabel[variation.field]}: {variation.canonical}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Replace {variation.variants.map((value) => `“${value}”`).join(', ')}{' '}
                      in {variation.entryCount}{' '}
                      {variation.entryCount === 1 ? 'entry' : 'entries'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={normalizing !== null}
                    onClick={() => void normalize(variation)}
                  >
                    {normalizing === key ? 'Normalizing…' : 'Normalize'}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}

      {report.incompleteEntries.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Missing required data ({report.incompleteEntries.length})
          </Typography>
          <Stack divider={<Divider flexItem />}>
            {report.incompleteEntries.map(({ entry, missing }) => (
              <Stack
                key={entry.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
                sx={{ py: 1.25 }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {entry.title || 'Untitled entry'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Missing {missing.join(' and ')}
                  </Typography>
                </Box>
                <Button component={RouterLink} to={editEntryPath(entry.id)} size="small">
                  Fix
                </Button>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      <Dialog open={mergeGroup !== null} onClose={() => !merging && setMergeGroup(null)}>
        <DialogTitle>Merge duplicate entries?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This keeps the most recently updated copy of “{mergeGroup?.entries[0]?.title}
            ”, combines its tags, genres, people, metadata and notes, then permanently
            deletes the other {Math.max(0, (mergeGroup?.entries.length ?? 1) - 1)}{' '}
            {(mergeGroup?.entries.length ?? 1) === 2 ? 'copy' : 'copies'}.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={merging} onClick={() => setMergeGroup(null)}>
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={merging}
            onClick={() => void mergeDuplicates()}
          >
            {merging ? 'Merging…' : 'Merge entries'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
