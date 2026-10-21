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
import { LibbyImportSection } from '@/components/settings/LibbyImportSection';
import { DisneyPlusImportSection } from '@/components/settings/DisneyPlusImportSection';

type ImportSource =
  | 'letterboxd'
  | 'goodreads'
  | 'imdb'
  | 'storygraph'
  | 'netflix'
  | 'amazonPrime'
  | 'libby'
  | 'disneyPlus';

type ImportSourceRow = {
  key: ImportSource;
  label: string;
  meta: string;
  slug?: BrandIconSlug;
  logo?: string;
  amazon?: boolean;
};

// Keep this list in the intended display order. Custom SVG logos are used
// for Disney+ and Libby so their marks are consistent across devices.
const ROWS: ImportSourceRow[] = [
  {
    key: 'netflix',
    label: 'Netflix',
    meta: 'Viewing Activity export from netflix.com',
    slug: 'netflix',
  },
  {
    key: 'amazonPrime',
    label: 'Amazon Prime Video',
    meta: 'Third-party watch-history export tool',
    amazon: true,
  },
  {
    key: 'disneyPlus',
    label: 'Disney+',
    meta: 'Viewing history export (.xlsx)',
    logo: '/logos/disney-plus.svg',
  },
  {
    key: 'letterboxd',
    label: 'Letterboxd',
    meta: 'Diary export from letterboxd.com',
    slug: 'letterboxd',
  },
  {
    key: 'imdb',
    label: 'IMDb',
    meta: 'Ratings export from imdb.com',
    slug: 'imdb',
  },
  {
    key: 'goodreads',
    label: 'Goodreads',
    meta: 'Library export from goodreads.com',
    slug: 'goodreads',
  },
  {
    key: 'libby',
    label: 'Libby',
    meta: 'Timeline export (.json)',
    logo: '/logos/libby.svg',
  },
  {
    key: 'storygraph',
    label: 'StoryGraph',
    meta: 'Library export from app.thestorygraph.com',
    slug: 'storygraph',
  },
];

/**
 * Settings > Import sources — a compact tappable list (icon, label,
 * one-line meta, chevron). Tapping a row opens that source's instructions
 * dialog, with one shared list controlling all import sections.
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
          <ListItemButton
            key={row.key}
            onClick={() => setOpenSource(row.key)}
            divider
            sx={{ px: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 44 }}>
              {row.logo ? (
                <Box
                  component="img"
                  src={row.logo}
                  alt={row.label + ' logo'}
                  sx={{
                    width: 32,
                    height: 32,
                    objectFit: 'contain',
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
              ) : row.amazon ? (
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    bgcolor: '#00A8E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LocalMoviesOutlinedIcon sx={{ fontSize: 17, color: '#0b1a24' }} />
                </Box>
              ) : (
                <BrandIcon slug={row.slug!} size={28} />
              )}
            </ListItemIcon>
            <ListItemText primary={row.label} secondary={row.meta} />
            <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          </ListItemButton>
        ))}
      </List>

      <NetflixImportSection
        open={openSource === 'netflix'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <AmazonPrimeImportSection
        open={openSource === 'amazonPrime'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <DisneyPlusImportSection
        open={openSource === 'disneyPlus'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <LetterboxdImportSection
        open={openSource === 'letterboxd'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <ImdbImportSection
        open={openSource === 'imdb'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <GoodreadsImportSection
        open={openSource === 'goodreads'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <LibbyImportSection
        open={openSource === 'libby'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <StoryGraphImportSection
        open={openSource === 'storygraph'}
        onCloseInstructions={() => setOpenSource(null)}
      />
    </Box>
  );
}
