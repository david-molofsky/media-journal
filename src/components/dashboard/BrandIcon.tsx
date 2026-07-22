import Box from '@mui/material/Box';
import { BRAND_ICONS, type BrandIconSlug } from '@/utils/brandIcons';

interface BrandIconProps {
  slug: BrandIconSlug;
  size?: number;
}

/**
 * Renders a service's real logo mark (via simple-icons — see
 * brandIcons.ts) in the brand's own colour. Deliberately rendered
 * directly on the surrounding surface rather than inside a coloured
 * badge — several of these brand colours are very dark (Letterboxd,
 * Goodreads) or very light (IMDb's yellow), and a same-colour badge
 * would either disappear against a dark background or fight it for
 * contrast. The icon alone, at its own hue, reads clearly either way.
 */
export function BrandIcon({ slug, size = 22 }: BrandIconProps) {
  const icon = BRAND_ICONS[slug];
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{ width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={icon.title}
    >
      <path d={icon.path} fill={`#${icon.hex}`} />
    </Box>
  );
}
