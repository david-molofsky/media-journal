import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TheatersOutlinedIcon from '@mui/icons-material/TheatersOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { LetterboxdImportSection } from '@/components/settings/LetterboxdImportSection';
import { GoodreadsImportSection } from '@/components/settings/GoodreadsImportSection';
import { ImdbImportSection } from '@/components/settings/ImdbImportSection';

type ImportSource = 'letterboxd' | 'goodreads' | 'imdb';

const ROWS: { key: ImportSource; label: string; meta: string; icon: SvgIconComponent }[] = [
  { key: 'letterboxd', label: 'Letterboxd', meta: 'Diary export from letterboxd.com', icon: TheatersOutlinedIcon },
  { key: 'goodreads', label: 'Goodreads', meta: 'Library export from goodreads.com', icon: AutoStoriesOutlinedIcon },
  { key: 'imdb', label: 'IMDb', meta: 'Ratings export from imdb.com', icon: StarOutlineOutlinedIcon },
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
        {ROWS.map((row, i) => (
          <ListItemButton
            key={row.key}
            onClick={() => setOpenSource(row.key)}
            divider={i < ROWS.length - 1}
            sx={{ px: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
              <row.icon />
            </ListItemIcon>
            <ListItemText primary={row.label} secondary={row.meta} />
            <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          </ListItemButton>
        ))}
      </List>

      <LetterboxdImportSection
        open={openSource === 'letterboxd'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <GoodreadsImportSection
        open={openSource === 'goodreads'}
        onCloseInstructions={() => setOpenSource(null)}
      />
      <ImdbImportSection open={openSource === 'imdb'} onCloseInstructions={() => setOpenSource(null)} />
    </Box>
  );
}
