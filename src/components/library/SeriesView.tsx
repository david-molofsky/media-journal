import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import type { MediaEntry, MediaType } from '@/models';
import { ROUTES } from '@/routes/paths';

interface SeriesViewProps {
  entries: MediaEntry[];
  mediaTypes: MediaType[];
}

interface SeriesGroup {
  name: string;
  mediaTypeId: string;
  colour: string;
  entries: MediaEntry[];
}

/**
 * Groups library entries by `metadata.series`, showing dot-progress
 * for each. Tapping a series applies a text search for that series
 * name in the Library (no extra route needed). Entries without a
 * series fall into a "Standalone" group at the bottom.
 */
export function SeriesView({ entries, mediaTypes }: SeriesViewProps) {
  const navigate = useNavigate();
  const mediaTypeById = new Map(mediaTypes.map((t) => [t.id, t]));

  const { groups, standalone } = useMemo(() => {
    const map = new Map<string, SeriesGroup>();
    const noSeries: MediaEntry[] = [];

    for (const entry of entries) {
      const series = typeof entry.metadata.series === 'string' ? entry.metadata.series : null;
      if (!series) {
        noSeries.push(entry);
        continue;
      }
      const key = `${entry.mediaType}::${series}`;
      if (!map.has(key)) {
        const colour = mediaTypeById.get(entry.mediaType)?.colour ?? '#616161';
        map.set(key, { name: series, mediaTypeId: entry.mediaType, colour, entries: [] });
      }
      map.get(key)!.entries.push(entry);
    }

    return {
      groups: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
      standalone: noSeries,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (groups.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        No series found. Add a "Series" value to a book, comic or TV entry to group it here.
      </Typography>
    );
  }

  const goToSeries = (name: string) => {
    navigate(ROUTES.library, { state: { searchText: name } });
  };

  return (
    <Stack spacing={1.5}>
      {groups.map((group) => {
        const typeName = mediaTypeById.get(group.mediaTypeId)?.displayName ?? group.mediaTypeId;
        const avgRating =
          group.entries.filter((e) => e.rating !== undefined).length > 0
            ? (
                group.entries.reduce((sum, e) => sum + (e.rating ?? 0), 0) /
                group.entries.filter((e) => e.rating !== undefined).length
              ).toFixed(1)
            : null;

        return (
          <Card
            key={`${group.mediaTypeId}::${group.name}`}
            variant="outlined"
            sx={{ borderRadius: 3, borderLeft: `4px solid ${group.colour}` }}
          >
            <CardActionArea onClick={() => goToSeries(group.name)} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="flex-start" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={600} noWrap>
                    {group.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {typeName} · {group.entries.length}{' '}
                    {group.entries.length === 1 ? 'entry' : 'entries'}
                    {avgRating ? ` · avg ${avgRating}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {group.entries.slice(0, 12).map((entry) => (
                      <Box
                        key={entry.id}
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: group.colour,
                          opacity: entry.rating !== undefined ? 1 : 0.3,
                        }}
                        title={entry.title}
                      />
                    ))}
                    {group.entries.length > 12 && (
                      <Typography variant="caption" color="text.secondary">
                        +{group.entries.length - 12}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                {avgRating && (
                  <Box
                    sx={{
                      bgcolor: group.colour,
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      borderRadius: 20,
                      px: 1.25,
                      py: 0.4,
                      lineHeight: 1.4,
                      flexShrink: 0,
                    }}
                  >
                    {avgRating}
                  </Box>
                )}
              </Stack>
            </CardActionArea>
          </Card>
        );
      })}

      {standalone.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            {standalone.length} standalone {standalone.length === 1 ? 'entry' : 'entries'} (no series)
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
