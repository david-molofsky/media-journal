import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BrandIcon } from './BrandIcon';
import { LetterboxdImportSection } from '@/components/settings/LetterboxdImportSection';
import { GoodreadsImportSection } from '@/components/settings/GoodreadsImportSection';
import { ImdbImportSection } from '@/components/settings/ImdbImportSection';
import { StoryGraphImportSection } from '@/components/settings/StoryGraphImportSection';
import { MalImportSection } from '@/components/settings/MalImportSection';
import { TraktImportSection } from '@/components/settings/TraktImportSection';
import type { BrandIconSlug } from '@/utils/brandIcons';

type CsvSource = 'letterboxd' | 'goodreads' | 'imdb' | 'storygraph';

const CSV_BOXES: { key: CsvSource; label: string; meta: string; icon: BrandIconSlug }[] = [
  { key: 'letterboxd', label: 'Letterboxd', meta: 'diary.csv', icon: 'letterboxd' },
  { key: 'goodreads', label: 'Goodreads', meta: 'library export', icon: 'goodreads' },
  { key: 'imdb', label: 'IMDb', meta: 'ratings export', icon: 'imdb' },
  { key: 'storygraph', label: 'StoryGraph', meta: 'library export', icon: 'storygraph' },
];

/**
 * Welcome screen (below the fold) — Version B from chat: no jump-link
 * sentence, the section speaks for itself once scrolled to. Tapping a
 * CSV box skips straight to that source's instructions dialog (bypasses
 * the intermediate row-list step ImportSourcesSection uses in
 * Settings); MyAnimeList and Trakt are reused as their existing full
 * cards unchanged, since they carry connect/sync state a plain
 * icon+label box can't represent. Every *ImportSection component here
 * is exactly the one Settings uses — fully self-contained, mounted
 * with local `open` state instead of Settings'. Google Drive stays out
 * of this grid (backup/restore, not "library import" — same reasoning
 * ImportSourcesSection already applies) and keeps its own text link
 * elsewhere on the welcome screen.
 */
export function WelcomeImportSources() {
  const [openSource, setOpenSource] = useState<CsvSource | null>(null);

  return (
    <Box sx={{ width: '100%', maxWidth: 420 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textAlign: 'left' }}>
        Import your library
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1.25,
          mb: 1.5,
        }}
      >
        {CSV_BOXES.map((source) => (
          <Box
            key={source.key}
            component="button"
            type="button"
            onClick={() => setOpenSource(source.key)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              py: 2,
              px: 1,
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <BrandIcon slug={source.icon} size={24} />
            <Typography variant="body2" fontWeight={600}>
              {source.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {source.meta}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack spacing={1.25}>
        <MalImportSection />
        <TraktImportSection />
      </Stack>

      <LetterboxdImportSection
        open={openSource === 'letterboxd'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <GoodreadsImportSection
        open={openSource === 'goodreads'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <ImdbImportSection open={openSource === 'imdb'} onCloseInstructions={() => setOpenSource(null)} />
      <StoryGraphImportSection
        open={openSource === 'storygraph'}
        onCloseInstructions={() => setOpenSource(null)}
      />
    </Box>
  );
}
