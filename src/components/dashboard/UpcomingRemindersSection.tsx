import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { db } from '@/services/database/db';
import { dismissReminder, snoozeReminder } from '@/services/database/reminderService';
import { ROUTES, entryDetailPath } from '@/routes/paths';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { getEntryImageUrl } from '@/utils/entryImage';
import type { Reminder } from '@/models';
import dayjs from 'dayjs';

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function UpcomingRemindersSection() {
  const navigate = useNavigate();
  const [snoozeId, setSnoozeId] = useState<string>();
  const [snoozeDays, setSnoozeDays] = useState('1');
  const [customDays, setCustomDays] = useState('5');
  const [actionError, setActionError] = useState('');

  const reminders = useLiveQuery(() => db.reminders.orderBy('dueAt').toArray(), [], []);
  const entries = useLiveQuery(() => db.mediaEntries.toArray(), [], []);
  const mediaTypes = useLiveQuery(() => db.mediaTypes.toArray(), [], []);

  const now = Date.now();
  const start = now - WINDOW_DAYS * DAY_MS;
  const end = now + WINDOW_DAYS * DAY_MS;
  const outstanding = (reminders ?? [])
    .filter((reminder) => !reminder.dismissedAt)
    .filter((reminder) => {
      const due = new Date(reminder.dueAt).getTime();
      return due >= start && due <= end;
    });
  const overdue = outstanding.filter((reminder) => new Date(reminder.dueAt).getTime() < now);
  const upcoming = outstanding.filter((reminder) => new Date(reminder.dueAt).getTime() >= now);
  const entryById = new Map((entries ?? []).map((entry) => [entry.id, entry]));
  const mediaTypeById = new Map((mediaTypes ?? []).map((type) => [type.id, type]));

  const confirmSnooze = async () => {
    const days = snoozeDays === 'custom' ? Number(customDays) : Number(snoozeDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setActionError('Enter a whole number of days between 1 and 365.');
      return;
    }
    try {
      if (snoozeId) await snoozeReminder(snoozeId, days);
      setSnoozeId(undefined);
      setActionError('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not snooze reminder.');
    }
  };

  const renderReminders = (items: Reminder[]) => (
    <Stack spacing={1.5}>
      {items.map((reminder) => {
        const entry = reminder.entryId ? entryById.get(reminder.entryId) : undefined;
        const mediaType = entry ? mediaTypeById.get(entry.mediaType) : undefined;
        const colour = mediaType?.colour ?? '#616161';
        const Icon = getMediaTypeIcon(mediaType?.icon ?? '');
        const imageUrl = entry ? getEntryImageUrl(entry) : undefined;

        return (
          <Card
            key={reminder.id}
            variant="outlined"
            sx={{
              borderRadius: 3,
              borderLeft: `4px solid ${colour}`,
              overflow: 'hidden',
            }}
          >
            <Stack direction="row" alignItems="stretch">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <CardActionArea
                  onClick={() =>
                    navigate(
                      reminder.entryId && entry
                        ? entryDetailPath(reminder.entryId)
                        : ROUTES.reminders,
                    )
                  }
                  sx={{ p: 1.5 }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {imageUrl ? (
                      <Box
                        component="img"
                        src={imageUrl}
                        alt=""
                        sx={{
                          width: 44,
                          height: 62,
                          borderRadius: 1.5,
                          flexShrink: 0,
                          objectFit: 'cover',
                          bgcolor: 'action.hover',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: `${colour}1A`,
                          color: colour,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon sx={{ fontSize: 22 }} />
                      </Box>
                    )}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {reminder.title}
                      </Typography>
                      {entry && (
                        <Typography variant="caption" sx={{ color: colour, fontWeight: 700 }}>
                          {mediaType?.name ?? entry.mediaType}
                          {entry.title !== reminder.title ? ` · ${entry.title}` : ''}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {dayjs(reminder.dueAt).format('ddd D MMM, HH:mm')}
                      </Typography>
                    </Box>
                  </Stack>
                </CardActionArea>
                <Stack direction="row" spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ScheduleOutlinedIcon />}
                    onClick={() => {
                      setSnoozeId(reminder.id);
                      setSnoozeDays('1');
                      setCustomDays('5');
                      setActionError('');
                    }}
                  >
                    Snooze
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloseOutlinedIcon />}
                    onClick={() => void dismissReminder(reminder.id)}
                  >
                    Dismiss
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );

  if (!overdue.length && !upcoming.length) return null;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Reminders
        </Typography>
        <Button size="small" onClick={() => navigate(ROUTES.reminders)}>
          Manage all
        </Button>
      </Stack>
      <Stack spacing={2.5}>
        {overdue.length > 0 && (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Past 7 days
            </Typography>
            {renderReminders(overdue)}
          </Box>
        )}
        {upcoming.length > 0 && (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Next 7 days
            </Typography>
            {renderReminders(upcoming)}
          </Box>
        )}
      </Stack>
      <Dialog
        open={Boolean(snoozeId)}
        onClose={() => setSnoozeId(undefined)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Snooze reminder</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Snooze for"
              value={snoozeDays}
              onChange={(event) => setSnoozeDays(event.target.value)}
              fullWidth
            >
              <MenuItem value="1">1 day</MenuItem>
              <MenuItem value="3">3 days</MenuItem>
              <MenuItem value="7">7 days</MenuItem>
              <MenuItem value="14">14 days</MenuItem>
              <MenuItem value="custom">Custom number of days</MenuItem>
            </TextField>
            {snoozeDays === 'custom' && (
              <TextField
                label="Number of days"
                type="number"
                value={customDays}
                onChange={(event) => setCustomDays(event.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
                fullWidth
              />
            )}
            {actionError && (
              <Typography variant="body2" color="error">
                {actionError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSnoozeId(undefined)}>Cancel</Button>
          <Button variant="contained" onClick={() => void confirmSnooze()}>
            Snooze
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
