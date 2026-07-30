import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import type { MediaType } from '@/models';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { useNumberSetting } from '@/hooks/useNumberSetting';
import { SETTINGS_KEYS } from '@/models';
import { ROUTES } from '@/routes/paths';

/** Tip card stops rendering once it's been shown (saved past or
 * dismissed) this many times — see AppSettings.ts. */
const TIP_MAX_SHOWS = 2;

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
  const navigate = useNavigate();
  const [tipShownCount, setTipShownCount] = useNumberSetting(
    SETTINGS_KEYS.addEntryTipShownCount,
    0,
  );
  const showTip = tipShownCount < TIP_MAX_SHOWS;

  const dismissTip = () => {
    if (tipShownCount < TIP_MAX_SHOWS) setTipShownCount(tipShownCount + 1);
  };

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

        {/* "More media types?" nudge — same size/shape as the type
            cards above so it sits in the grid like a peer rather than
            a banner. Shown up to TIP_MAX_SHOWS times per device, then
            never again (see useNumberSetting + AddEntryPage's
            increment-on-save). Points at Settings > Manage media
            types, which already exists and isn't changed by this. */}
        {showTip && (
          <Grid key="more-types-tip" size={{ xs: 6, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{ borderRadius: 4, height: '100%', position: 'relative' }}
            >
              <IconButton
                size="small"
                aria-label="Dismiss tip"
                onClick={dismissTip}
                sx={{ position: 'absolute', top: 4, right: 4 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
              <CardActionArea
                onClick={() => navigate(ROUTES.settings)}
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
                <TipsAndUpdatesOutlinedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                <Typography
                  variant="body2"
                  fontWeight={600}
                  textAlign="center"
                  color="primary.main"
                >
                  Want more types? Enable them in Settings
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
