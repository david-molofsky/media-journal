import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useInProgressEntries } from '@/hooks/useInProgressEntries';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import {
  createInProgressEntry,
  deleteInProgressEntry,
  finishInProgressEntry,
} from '@/services/database/inProgressService';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { todayIso } from '@/utils/dateUtils';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { RatingInput } from '@/components/forms/RatingInput';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES, editEntryPath } from '@/routes/paths';

dayjs.extend(relativeTime);

export default function InProgressPage() {
  const navigate = useNavigate();
  const entries = useInProgressEntries();
  const mediaTypes = useMediaTypes();

  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addMediaType, setAddMediaType] = useState('');
  const [addStarted, setAddStarted] = useState(todayIso());

  const [finishId, setFinishId] = useState<string | null>(null);
  const [finishDate, setFinishDate] = useState(todayIso());
  const [finishRating, setFinishRating] = useState<number | undefined>(undefined);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!entries || !mediaTypes) return <LoadingIndicator />;

  const mediaTypeById = new Map(mediaTypes.map((t) => [t.id, t]));

  const handleAdd = async () => {
    if (!addTitle.trim() || !addMediaType) return;
    await createInProgressEntry({
      title: addTitle.trim(),
      mediaType: addMediaType,
      startedDate: addStarted || undefined,
      metadata: {},
      tags: [],
    });
    setAddOpen(false);
    setAddTitle('');
    setAddMediaType('');
    setAddStarted(todayIso());
  };

  const handleFinish = async () => {
    if (!finishId) return;
    const created = await finishInProgressEntry(finishId, finishDate || todayIso(), finishRating);
    setFinishId(null);
    setFinishRating(undefined);
    navigate(editEntryPath(created.id));
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(ROUTES.dashboard)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600} sx={{ flex: 1 }}>
          In Progress
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
          Add
        </Button>
      </Stack>

      {entries.length === 0 ? (
        <PagePlaceholder
          title="Nothing in progress"
          description="Start tracking what you're currently reading, watching or listening to."
        />
      ) : (
        <Stack spacing={1.5}>
          {entries.map((entry) => {
            const mediaType = mediaTypeById.get(entry.mediaType);
            const colour = mediaType?.colour ?? '#616161';
            const Icon = getMediaTypeIcon(mediaType?.icon ?? '');
            return (
              <Card
                key={entry.id}
                variant="outlined"
                sx={{ borderRadius: 3, borderLeft: `4px solid ${colour}` }}
              >
                <CardActionArea sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: `${colour}1A`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ color: colour, fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {entry.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {mediaType?.displayName ?? entry.mediaType} ·{' '}
                        {entry.startedDate
                          ? `Started ${dayjs(entry.startedDate).fromNow()}`
                          : 'Recently started'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardActionArea>
                <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
                  <Button
                    size="small"
                    startIcon={<CheckCircleOutlineIcon />}
                    onClick={() => { setFinishId(entry.id); setFinishDate(todayIso()); setFinishRating(undefined); }}
                  >
                    Mark as finished
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => setDeleteId(entry.id)}
                    sx={{ ml: 'auto' }}
                  >
                    Remove
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Start tracking</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Title"
              autoFocus
              fullWidth
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {mediaTypes.map((type) => (
                <Button
                  key={type.id}
                  size="small"
                  variant={addMediaType === type.id ? 'contained' : 'outlined'}
                  onClick={() => setAddMediaType(type.id)}
                  sx={{
                    borderColor: type.colour,
                    color: addMediaType === type.id ? '#fff' : type.colour,
                    bgcolor: addMediaType === type.id ? type.colour : undefined,
                    '&:hover': { bgcolor: addMediaType === type.id ? type.colour : `${type.colour}1A` },
                  }}
                >
                  {type.displayName}
                </Button>
              ))}
            </Stack>
            <TextField
              label="Started"
              type="date"
              fullWidth
              value={addStarted}
              onChange={(e) => setAddStarted(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!addTitle.trim() || !addMediaType}
          >
            Start tracking
          </Button>
        </DialogActions>
      </Dialog>

      {/* Finish dialog */}
      <Dialog
        open={Boolean(finishId)}
        onClose={() => { setFinishId(null); setFinishRating(undefined); }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Mark as finished</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Confirm the date and rating. You'll land on the full edit form to add notes.
            </Typography>
            <TextField
              label="Completed date"
              type="date"
              fullWidth
              value={finishDate}
              onChange={(e) => setFinishDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <RatingInput value={finishRating} onChange={setFinishRating} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setFinishId(null); setFinishRating(undefined); }}>Cancel</Button>
          <Button variant="contained" onClick={handleFinish}>Finish & rate</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Remove from in progress?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This removes the tracking entry without creating a library record. Use "Mark as finished" instead to save it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" onClick={async () => { if (deleteId) await deleteInProgressEntry(deleteId); setDeleteId(null); }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
