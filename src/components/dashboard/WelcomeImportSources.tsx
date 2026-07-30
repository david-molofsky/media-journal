import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LocalMoviesOutlinedIcon from '@mui/icons-material/LocalMoviesOutlined';
import { BrandIcon } from './BrandIcon';
import { LetterboxdImportSection } from '@/components/settings/LetterboxdImportSection';
import { GoodreadsImportSection } from '@/components/settings/GoodreadsImportSection';
import { ImdbImportSection } from '@/components/settings/ImdbImportSection';
import { StoryGraphImportSection } from '@/components/settings/StoryGraphImportSection';
import { MalImportSection } from '@/components/settings/MalImportSection';
import { TraktImportSection } from '@/components/settings/TraktImportSection';
import { AudiobookshelfImportSection } from '@/components/settings/AudiobookshelfImportSection';
import { JellyfinImportSection } from '@/components/settings/JellyfinImportSection';
import { PlexImportSection } from '@/components/settings/PlexImportSection';
import { NetflixImportSection } from '@/components/settings/NetflixImportSection';
import { AmazonPrimeImportSection } from '@/components/settings/AmazonPrimeImportSection';
import type { BrandIconSlug } from '@/utils/brandIcons';

interface WelcomeImportSourcesProps {
  /** Opens Settings (Google Drive tile — see chat: Drive's own OAuth
   * flow is bigger than a simple connect form, so its tile just
   * navigates rather than opening a mini connect dialog like the
   * others). */
  onOpenSettings: () => void;
}

type CsvSource = 'letterboxd' | 'goodreads' | 'imdb' | 'storygraph' | 'netflix' | 'amazonPrime';

const CSV_BOXES: { key: CsvSource; label: string; meta: string; icon: BrandIconSlug }[] = [
  { key: 'letterboxd', label: 'Letterboxd', meta: 'diary.csv', icon: 'letterboxd' },
  { key: 'goodreads', label: 'Goodreads', meta: 'library export', icon: 'goodreads' },
  { key: 'imdb', label: 'IMDb', meta: 'ratings export', icon: 'imdb' },
  { key: 'storygraph', label: 'StoryGraph', meta: 'library export', icon: 'storygraph' },
];

const tileSx = {
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
} as const;

/**
 * Welcome screen (below the fold) — Version B from chat: no jump-link
 * sentence, the section speaks for itself once scrolled to. Netflix
 * and Amazon Prime Video sit in the top grid positions (see chat —
 * both new import sources, most people's most-used services). Tapping
 * a box skips straight to that source's instructions dialog (bypasses
 * the intermediate row-list step ImportSourcesSection uses in
 * Settings); MyAnimeList, Trakt, Audiobookshelf, Jellyfin, and Plex
 * all use their 'box' variant (see MalImportSection.tsx and siblings)
 * — same underlying hooks/dialogs as Settings' row variant, just a
 * matching tap-card trigger instead of a full row. Google Drive is
 * the 12th tile, rounding the grid out to 4 rows of 3 (see chat) —
 * unlike the others it navigates to Settings rather than opening a
 * connect dialog, since Drive's own OAuth flow is a bigger thing than
 * a simple server-URL-and-token form.
 */
export function WelcomeImportSources({ onOpenSettings }: WelcomeImportSourcesProps) {
  const [openSource, setOpenSource] = useState<CsvSource | null>(null);

  return (
    <Box sx={{ width: '100%', maxWidth: 420 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textAlign: 'left' }}>
        Import your library
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1,
        }}
      >
        <Box component="button" type="button" onClick={() => setOpenSource('netflix')} sx={tileSx}>
          <BrandIcon slug="netflix" size={32} />
          <Typography variant="body2" fontWeight={600}>Netflix</Typography>
          <Typography variant="caption" color="text.secondary">viewing history</Typography>
        </Box>

        <Box component="button" type="button" onClick={() => setOpenSource('amazonPrime')} sx={tileSx}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: '#00A8E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalMoviesOutlinedIcon sx={{ fontSize: 19, color: '#0b1a24' }} />
          </Box>
          <Typography variant="body2" fontWeight={600}>Amazon Prime</Typography>
          <Typography variant="caption" color="text.secondary">3rd-party export tool</Typography>
        </Box>

        {CSV_BOXES.map((source) => (
          <Box
            key={source.key}
            component="button"
            type="button"
            onClick={() => setOpenSource(source.key)}
            sx={tileSx}
          >
            <BrandIcon slug={source.icon} size={32} />
            <Typography variant="body2" fontWeight={600}>
              {source.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {source.meta}
            </Typography>
          </Box>
        ))}

        <MalImportSection variant="box" />
        <TraktImportSection variant="box" />
        <AudiobookshelfImportSection variant="box" />
        <JellyfinImportSection variant="box" />
        <PlexImportSection variant="box" />

        <Box component="button" type="button" onClick={onOpenSettings} sx={tileSx}>
          <BrandIcon slug="googledrive" size={32} />
          <Typography variant="body2" fontWeight={600}>Google Drive</Typography>
          <Typography variant="caption" color="text.secondary">restore a backup</Typography>
        </Box>
      </Box>

      <NetflixImportSection
        open={openSource === 'netflix'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <AmazonPrimeImportSection
        open={openSource === 'amazonPrime'}
        onCloseInstructions={() => setOpenSource(null)}
      />
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
