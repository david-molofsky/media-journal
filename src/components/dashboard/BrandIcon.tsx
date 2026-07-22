import Box from '@mui/material/Box';
import { BRAND_ICONS, type BrandIconSlug } from '@/utils/brandIcons';

interface BrandIconProps {
  slug: BrandIconSlug;
  size?: number;
}

/**
 * Renders a service's real logo mark (via simple-icons — see
 * brandIcons.ts) in the brand's own colour, on a small white badge.
 *
 * The badge isn't optional styling — several brand colours (Letterboxd
 * #202830, Goodreads #1E1914) are dark enough to nearly vanish against
 * this app's dark surfaces (confirmed in testing — see chat). These
 * marks are designed for a light backdrop; giving every one a
 * consistent white badge, rather than only the dark-hued ones, fixes
 * it uniformly and reads the same in light or dark mode.
 */
export function BrandIcon({ slug, size = 28 }: BrandIconProps) {
  const icon = BRAND_ICONS[slug];
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        p: size / 7,
      }}
    >
      <Box component="svg" viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }} role="img" aria-label={icon.title}>
        <path d={icon.path} fill={`#${icon.hex}`} />
      </Box>
    </Box>
  );
}
