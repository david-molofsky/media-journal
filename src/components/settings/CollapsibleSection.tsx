import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SvgIconComponent } from '@mui/icons-material';

interface CollapsibleSectionProps {
  title: string;
  icon?: SvgIconComponent;
  /** Small "X/Y on" style badge next to the title — visible whether
   * collapsed or expanded, so the state is readable at a glance
   * without opening the section. */
  badge?: string;
  /** All three toggle-heavy sections (TMDB/ComicVine auto-fill, Manage
   * media types) start collapsed by default, per the Settings
   * reorganisation — see chat. */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * Shared collapse/expand wrapper for the Settings sections that are
 * mostly a long list of toggles. Owns only the header row (icon,
 * title, badge, chevron) and the open/closed animation — each section
 * keeps its own description text and toggle rows as `children`, so
 * this doesn't change what's rendered, only whether it's visible.
 */
export function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Box>
      <ButtonBase
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        sx={{ width: '100%', justifyContent: 'space-between', py: 0.5, borderRadius: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {Icon && <Icon fontSize="small" sx={{ color: 'text.secondary' }} />}
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          {badge && <Chip label={badge} size="small" sx={{ height: 20, fontSize: 11 }} />}
        </Stack>
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </ButtonBase>
      <Collapse in={expanded} timeout={150}>
        <Box sx={{ pt: 2 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}
