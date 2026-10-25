import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { db } from '@/services/database/db';
import { ROUTES, entryDetailPath } from '@/routes/paths';
import dayjs from 'dayjs';

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function UpcomingRemindersSection() {
  const navigate = useNavigate();
  const sections = useLiveQuery(
    async () => {
      const now = Date.now();
      const start = now - WINDOW_DAYS * DAY_MS;
      const end = now + WINDOW_DAYS * DAY_MS;
      const outstanding = (await db.reminders.orderBy('dueAt').toArray())
        .filter((reminder) => !reminder.dismissedAt)
        .filter((reminder) => {
          const due = new Date(reminder.dueAt).getTime();
          return due >= start && due <= end;
        });
      return {
        overdue: outstanding.filter(
          (reminder) => new Date(reminder.dueAt).getTime() < now,
        ),
        upcoming: outstanding.filter(
          (reminder) => new Date(reminder.dueAt).getTime() >= now,
        ),
      };
    },
    [],
    { overdue: [], upcoming: [] },
  );

  if (!sections.overdue.length && !sections.upcoming.length) return null;

  const renderReminders = (items: typeof sections.upcoming) => (
    <Stack spacing={1.5}>
      {items.map((reminder) => (
        <Card key={reminder.id} variant="outlined" sx={{ borderRadius: 3 }}>
          <CardActionArea
            onClick={() =>
              navigate(
                reminder.entryId ? entryDetailPath(reminder.entryId) : ROUTES.reminders,
              )
            }
            sx={{ p: 1.5 }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              {reminder.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dayjs(reminder.dueAt).format('ddd D MMM, HH:mm')}
            </Typography>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );

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
        {sections.overdue.length > 0 && (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Past 7 days
            </Typography>
            {renderReminders(sections.overdue)}
          </Box>
        )}
        {sections.upcoming.length > 0 && (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Next 7 days
            </Typography>
            {renderReminders(sections.upcoming)}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
