import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { MediaType } from '@/models';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';

interface MediaTypePickerProps {
  mediaTypes: MediaType[];
  onSelect: (mediaType: MediaType) => void;
}

/**
 * Step 1 of Add Entry: large icon buttons for media type selection
 * (UI & UX Specification, section 6: "Step 1 — Select media type.
 * Large icon buttons."). Renders whatever is enabled in the
 * `mediaTypes` table, so a type added later in Settings (Milestone 7)
 * appears here automatically.
 */
export function MediaTypePicker({ mediaTypes, onSelect }: MediaTypePickerProps) {
  if (mediaTypes.length === 0) {
    return (
      <Box sx={{ px: 3, pt: 6, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No media types are enabled. Enable one in Settings to add an entry.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Typography variant="h6" component="h1" fontWeight={600} gutterBottom>
        What did you finish?
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {mediaTypes.map((mediaType) => {
          const Icon = getMediaTypeIcon(mediaType.icon);
          return (
            <Grid key={mediaType.id} size={{ xs: 6, sm: 4 }}>
              <Card variant="outlined" sx={{ borderRadius: 4, height: '100%' }}>
                <CardActionArea
                  onClick={() => onSelect(mediaType)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    py: 3,
                    px: 1,
                    minHeight: 120,
                    height: '100%',
                  }}
                >
                  <Icon sx={{ fontSize: 40, color: mediaType.colour }} />
                  <Typography variant="subtitle1" fontWeight={600} textAlign="center">
                    {mediaType.displayName}
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
