import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalMoviesOutlinedIcon from '@mui/icons-material/LocalMoviesOutlined';
import { BrandIcon } from '@/components/dashboard/BrandIcon';
import type { BrandIconSlug } from '@/utils/brandIcons';
import { LetterboxdImportSection } from '@/components/settings/LetterboxdImportSection';
import { GoodreadsImportSection } from '@/components/settings/GoodreadsImportSection';
import { ImdbImportSection } from '@/components/settings/ImdbImportSection';
import { StoryGraphImportSection } from '@/components/settings/StoryGraphImportSection';
import { NetflixImportSection } from '@/components/settings/NetflixImportSection';
import { AmazonPrimeImportSection } from '@/components/settings/AmazonPrimeImportSection';

type ImportSource = 'letterboxd' | 'goodreads' | 'imdb' | 'storygraph' | 'netflix' | 'amazonPrime';

/** `slug` matches BrandIconSlug exactly for these four — real logos
 * via BrandIcon (simple-icons), same as MyAnimeList/Trakt below them
 * in Import data, rather than generic Material icons (see chat: "all
 * 6 logos" standardisation). Netflix has a real BrandIcon slug too;
 * Amazon Prime Video doesn't (no mark in simple-icons), so it renders
 * with a plain Material icon in Amazon's brand blue instead — see
 * the inline row below rather than the ROWS/BrandIcon table. */
const ROWS: { key: ImportSource; label: string; meta: string; slug: BrandIconSlug }[] = [
  { key: 'netflix', label: 'Netflix', meta: 'Viewing Activity export from netflix.com', slug: 'netflix' },
  {
    key: 'letterboxd',
    label: 'Letterboxd',
    meta: 'Diary export from letterboxd.com',
    slug: 'letterboxd',
  },
  {
    key: 'goodreads',
    label: 'Goodreads',
    meta: 'Library export from goodreads.com',
    slug: 'goodreads',
  },
  { key: 'imdb', label: 'IMDb', meta: 'Ratings export from imdb.com', slug: 'imdb' },
  {
    key: 'storygraph',
    label: 'StoryGraph',
    meta: 'Library export from app.thestorygraph.com',
    slug: 'storygraph',
  },
];

/**
 * Settings > Import sources — a compact tappable list (icon, label,
 * one-line meta, chevron) rather than each source getting its own
 * always-expanded card with a paragraph of instructions. Tapping a row
 * opens that source's instructions dialog (see
 * ImportInstructionsDialog); which row is open lives here rather than
 * in each *ImportSection, so one shared list can control all three
 * (see chat).
 */
export function ImportSourcesSection() {
  const [openSource, setOpenSource] = useState<ImportSource | null>(null);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Import sources
      </Typography>
      <List disablePadding>
        {ROWS.map((row) => (
          <ListItemButton key={row.key} onClick={() => setOpenSource(row.key)} divider sx={{ px: 1 }}>
            <ListItemIcon sx={{ minWidth: 44 }}>
              <BrandIcon slug={row.slug} size={28} />
            </ListItemIcon>
            <ListItemText primary={row.label} secondary={row.meta} />
            <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          </ListItemButton>
        ))}
        <ListItemButton onClick={() => setOpenSource('amazonPrime')} sx={{ px: 1 }}>
          <ListItemIcon sx={{ minWidth: 44 }}>
            <Box
              sx={{
                width: 28, height: 28, borderRadius: 1.5, bgcolor: '#00A8E1',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <LocalMoviesOutlinedIcon sx={{ fontSize: 17, color: '#0b1a24' }} />
            </Box>
          </ListItemIcon>
          <ListItemText primary="Amazon Prime Video" secondary="Third-party watch-history export tool" />
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        </ListItemButton>
      </List>

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
      <ImdbImportSection
        open={openSource === 'imdb'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <StoryGraphImportSection
        open={openSource === 'storygraph'}
        onCloseInstructions={() => setOpenSource(null)}
      />
    </Box>
  );
}
