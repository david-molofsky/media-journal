import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { getMessaging, getToken } from 'firebase/messaging';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import {
  deleteReminder,
  saveReminder,
  snoozeReminder,
} from '@/services/database/reminderService';
import { getFirebaseServices } from '@/services/sync/firebaseClient';
import {
  registerReminderPushToken,
  syncPendingRemindersToPushBackend,
} from '@/services/sync/reminderPushService';
import { EntryDatePicker } from '@/components/forms/EntryDatePicker';

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];

export default function RemindersPage() {
  const location = useLocation();
  const prefill = location.state as {
    prefillEntryId?: string;
    prefillTitle?: string;
  } | null;
  const entries = useLiveQuery(() => db.mediaEntries.toArray(), [], []);
  const reminders = useLiveQuery(() => db.reminders.orderBy('dueAt').toArray(), [], []);
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState(prefill?.prefillTitle ?? '');
  const [entryId, setEntryId] = useState(prefill?.prefillEntryId ?? '');
  const [date, setDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [hour, setHour] = useState('19');
  const [minute, setMinute] = useState('00');
  const [error, setError] = useState('');
  const sortedEntries = useMemo(
    () => [...(entries ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    [entries],
  );

  const reset = () => {
    setEditingId(undefined);
    setTitle('');
    setEntryId('');
    setDate(dayjs().add(1, 'day').format('YYYY-MM-DD'));
    setHour('19');
    setMinute('00');
    setError('');
  };

  const edit = (reminder: NonNullable<typeof reminders>[number]) => {
    setEditingId(reminder.id);
    setTitle(reminder.title);
    setEntryId(reminder.entryId ?? '');
    const due = dayjs(reminder.dueAt);
    setDate(due.format('YYYY-MM-DD'));
    setHour(due.format('HH'));
    setMinute(
      ['00', '15', '30', '45'].includes(due.format('mm')) ? due.format('mm') : '00',
    );
    setError('');
  };

  const submit = async () => {
    const dueAt = dayjs(date)
      .hour(Number(hour))
      .minute(Number(minute))
      .second(0)
      .millisecond(0);
    if (dueAt.valueOf() <= Date.now()) {
      setError('Choose a date and time in the future.');
      return;
    }
    try {
      await saveReminder(
        { title, dueAt: dueAt.toISOString(), ...(entryId ? { entryId } : {}) },
        editingId,
      );
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reminder.');
    }
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setError('This browser does not support notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was not granted.');
        return;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        setError(
          'Notifications are permitted while Media Journal is open. Background push testing still needs VITE_FIREBASE_VAPID_KEY configured.',
        );
        return;
      }
      if (!('serviceWorker' in navigator)) {
        setError('This browser does not support service workers for push notifications.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const { app } = getFirebaseServices();
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        setError('Firebase did not return a push registration token for this device.');
        return;
      }

      await registerReminderPushToken(token);
      await syncPendingRemindersToPushBackend(reminders ?? []);
      setError(
        `Notifications enabled for this device. Synced ${reminders?.length ?? 0} existing reminder(s).`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not register this device for push notifications: ${e.message}`
          : 'Could not register this device for push notifications.',
      );
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <NotificationsActiveOutlinedIcon color="primary" />
        <Typography variant="h6" component="h1" fontWeight={600}>
          Reminders
        </Typography>
      </Stack>
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {editingId ? 'Edit reminder' : 'New reminder'}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Reminder"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              placeholder="e.g. Watch Scrubs"
            />
            <TextField
              select
              label="Link to a journal entry (optional)"
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">No linked entry</MenuItem>
              {sortedEntries.map((entry) => (
                <MenuItem key={entry.id} value={entry.id}>
                  {entry.title}
                </MenuItem>
              ))}
            </TextField>
            <EntryDatePicker
              label="Date"
              value={date}
              onChange={(next) => {
                if (next) setDate(next);
              }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Hour"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                fullWidth
              >
                {hours.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Minute"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                fullWidth
              >
                {minutes.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {error && (
              <Typography
                variant="body2"
                color={error.includes('succeeded') || error.includes('Notifications enabled') ? 'success.main' : 'error.main'}
                sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}
              >
                {error}
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="contained" onClick={() => void submit()}>
                {editingId ? 'Save changes' : 'Add reminder'}
              </Button>
              <Button variant="outlined" onClick={() => void enableNotifications()}>
                Enable notifications
              </Button>
              {editingId && <Button onClick={reset}>Cancel edit</Button>}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        Scheduled reminders
      </Typography>
      {!reminders?.length ? (
        <Typography color="text.secondary" variant="body2">
          No reminders yet.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {reminders.map((reminder) => {
            const linked = sortedEntries.find((entry) => entry.id === reminder.entryId);
            return (
              <Card key={reminder.id} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    '&:last-child': { pb: 2 },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600}>{reminder.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dayjs(reminder.dueAt).format('ddd D MMM YYYY, HH:mm')}
                    </Typography>
                    {linked && (
                      <Typography variant="caption" color="text.secondary">
                        Entry: {linked.title}
                      </Typography>
                    )}
                  </Box>
                  <IconButton aria-label="Edit reminder" onClick={() => edit(reminder)}>
                    <EditOutlinedIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Snooze for 24 hours"
                    onClick={() => void snoozeReminder(reminder.id)}
                  >
                    <NotificationsActiveOutlinedIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel reminder"
                    onClick={() => void deleteReminder(reminder.id)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
