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

export function UpcomingRemindersSection() {
  const navigate = useNavigate();
  const reminders = useLiveQuery(
    async () =>
      (await db.reminders.orderBy('dueAt').toArray())
        .filter((r) => new Date(r.dueAt).getTime() > Date.now())
        .slice(0, 3),
    [],
    [],
  );
  if (!reminders?.length) return null;
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Upcoming reminders
        </Typography>
        <Button size="small" onClick={() => navigate(ROUTES.reminders)}>
          Manage
        </Button>
      </Stack>
      <Stack spacing={1.5}>
        {reminders.map((reminder) => (
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
    </Box>
  );
}
