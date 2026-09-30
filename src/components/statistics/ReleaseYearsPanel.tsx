import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import type { MediaType } from '@/models';
import { db } from '@/services/database/db';
import {
  applyStatsFilters,
  isWithinYearScope,
  type StatsFilters,
  type StatsYearScope,
} from '@/services/statistics/statisticsService';
import { releaseYearOf } from '@/services/statistics/releaseYears';
import { entryDetailPath } from '@/routes/paths';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';

export function ReleaseYearsPanel({
  year,
  filters,
  mediaTypes,
}: {
  year: StatsYearScope;
  filters: StatsFilters;
  mediaTypes: MediaType[];
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const entries = useLiveQuery(
    async () =>
      applyStatsFilters(await db.mediaEntries.toArray(), filters).filter(
        (entry) =>
          (!entry.status || entry.status === 'completed') &&
          isWithinYearScope(entry.completedDate, year),
      ),
    [year, JSON.stringify(filters)],
  );
  if (entries === undefined) return <LoadingIndicator />;
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = String(releaseYearOf(entry) ?? 'Unknown');
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  const years = [...groups.keys()].sort((a, b) =>
    a === 'Unknown' ? 1 : b === 'Unknown' ? -1 : Number(b) - Number(a),
  );
  const activeYear = selected && groups.has(selected) ? selected : '';
  const selectedEntries = activeYear ? groups.get(activeYear) : undefined;
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Years</Typography>
      <Typography variant="body2" color="text.secondary">
        Release or publication year across media types. Uses the period and filters
        selected above.
      </Typography>
      {years.length === 0 && (
        <Typography variant="body2">No entries match these filters.</Typography>
      )}
      {years.length > 0 && (
        <FormControl fullWidth size="small">
          <InputLabel htmlFor="release-year-select" shrink>
            Release year
          </InputLabel>
          <Select
            native
            value={activeYear}
            label="Release year"
            onChange={(event) => setSelected(event.target.value || null)}
            inputProps={{ id: 'release-year-select' }}
          >
            <option value="">Select a year</option>
            {years.map((releaseYear) => (
              <option key={releaseYear} value={releaseYear}>
                {releaseYear} · {groups.get(releaseYear)!.length}{' '}
                {groups.get(releaseYear)!.length === 1 ? 'entry' : 'entries'}
              </option>
            ))}
          </Select>
        </FormControl>
      )}
      {selectedEntries && (
        <Stack spacing={0.5} aria-live="polite">
          <Typography variant="subtitle2">{selected}</Typography>
          {[...selectedEntries]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((entry) => (
              <Button
                key={entry.id}
                onClick={() => navigate(entryDetailPath(entry.id))}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  textTransform: 'none',
                }}
              >
                {entry.title} ·{' '}
                {mediaTypes.find((type) => type.id === entry.mediaType)?.displayName ??
                  entry.mediaType}
              </Button>
            ))}
        </Stack>
      )}
    </Stack>
  );
}
