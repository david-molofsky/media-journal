import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Collapse from '@mui/material/Collapse';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useGoals } from '@/hooks/useGoals';
import { setGoal } from '@/services/database/goalsService';
import type { MediaType } from '@/models';

interface GoalsSectionProps {
  year: number;
  mediaTypes: MediaType[];
  totalsByMediaType: Record<string, number>;
}

/**
 * Dashboard goals section: per-type progress bars with an inline
 * "Edit goals" form. Goals are optional — types without a target are
 * hidden in view mode and shown as blank inputs in edit mode.
 */
export function GoalsSection({ year, mediaTypes, totalsByMediaType }: GoalsSectionProps) {
  const goals = useGoals(year);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const hasAnyGoal = goals && Object.keys(goals).length > 0;

  const handleEditOpen = () => {
    const initial: Record<string, string> = {};
    for (const type of mediaTypes) {
      initial[type.id] = goals?.[type.id] !== undefined ? String(goals[type.id]) : '';
    }
    setDrafts(initial);
    setEditing(true);
  };

  const handleSave = async () => {
    for (const [mediaTypeId, raw] of Object.entries(drafts)) {
      const value = raw.trim() === '' ? undefined : Number(raw);
      await setGoal(year, mediaTypeId, value);
    }
    setEditing(false);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {year} Goals
        </Typography>
        <Button
          size="small"
          startIcon={editing ? <CheckIcon /> : <EditOutlinedIcon />}
          onClick={editing ? handleSave : handleEditOpen}
        >
          {editing ? 'Save' : 'Edit goals'}
        </Button>
      </Stack>

      <Collapse in={editing}>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {mediaTypes.map((type) => (
            <Stack key={type.id} direction="row" alignItems="center" spacing={2}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {type.displayName}
              </Typography>
              <TextField
                size="small"
                type="number"
                placeholder="No goal"
                value={drafts[type.id] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [type.id]: e.target.value }))}
                sx={{ width: 110 }}
                slotProps={{ input: { inputProps: { min: 1 } } }}
              />
            </Stack>
          ))}
        </Stack>
      </Collapse>

      <Collapse in={!editing}>
        {hasAnyGoal ? (
          <Stack spacing={1.5}>
            {mediaTypes
              .filter((type) => goals?.[type.id] !== undefined)
              .map((type) => {
                const target = goals![type.id]!;
                const current = totalsByMediaType[type.id] ?? 0;
                const pct = Math.min(100, Math.round((current / target) * 100));
                return (
                  <Box key={type.id}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{type.displayName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {current} / {target}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { bgcolor: type.colour },
                      }}
                    />
                  </Box>
                );
              })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No goals set for {year} — tap "Edit goals" to add targets.
          </Typography>
        )}
      </Collapse>
    </Box>
  );
}
