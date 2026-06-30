import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface PagePlaceholderProps {
  title: string;
  description: string;
}

/**
 * Generic placeholder shown for pages that have not been implemented
 * yet. Replaced milestone by milestone as each screen is built out.
 *
 * Also doubles as the visual basis for genuine empty states (UI & UX
 * Specification, section 10) once real pages are wired up.
 */
export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '60vh',
        gap: 1,
        px: 3,
      }}
    >
      <Typography variant="h5" component="h1" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" maxWidth={420}>
        {description}
      </Typography>
    </Box>
  );
}
