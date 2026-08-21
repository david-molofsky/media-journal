import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import type StarIcon from '@mui/icons-material/Star';

interface StatTileProps {
  icon: typeof StarIcon;
  /** Solid badge colour — deliberately a bright, distinct hue per tile
   * rather than reusing any of the app's 13 media-type colours (all
   * of which are already claimed, see chat, Aug 2026 — a Statistics
   * tile in "Film red" or "TV green" would misleadingly suggest it's
   * about that media type specifically). */
  colour: string;
  title: string;
  description: string;
  /** Collapsible tiles pass `expanded` + omit `href`; the Timeline
   * tile passes neither and is handled by the caller as a plain nav
   * link instead (see chat, Aug 2026 — not expandable, just a
   * shortcut to the Timeline page). */
  expanded?: boolean;
  onClick: () => void;
}

export function StatTile({ icon: Icon, colour, title, description, expanded, onClick }: StatTileProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'block',
        textAlign: 'left',
        width: '100%',
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: expanded ? colour : 'divider',
        bgcolor: 'background.paper',
        p: 1.5,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          bgcolor: colour,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <Icon sx={{ color: '#fff', fontSize: 18 }} />
      </Box>
      <Typography variant="body2" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mt: 0.25 }}>
        {description}
      </Typography>
    </ButtonBase>
  );
}
