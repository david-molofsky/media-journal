import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';

/**
 * Controls Open Library's cover image auto-fill for Book/Audiobook
 * entries (MetadataSearch's search step, the ISBN scan dialog, and the
 * "add via shared link" flow — all three funnel through
 * openLibraryService.ts, which reads this one setting). Same
 * persisted-in-Settings convention as TmdbAutofillSection /
 * ComicVineAutofillSection.
 *
 * Author and Series aren't gated by a toggle at all — Open Library
 * fills those unconditionally, same as it always has — so Cover image
 * is the only control this section needs. Defaults to on, matching
 * TMDB's Poster and ComicVine's Cover image toggles.
 */
export function OpenLibraryAutofillSection() {
  const [coverImage, setCoverImage] = useBooleanSetting('autofillBookCoverImage', true);
  const [releaseYear, setReleaseYear] = useBooleanSetting('autofillBookReleaseYear', true);

  const onCount = [coverImage, releaseYear].filter(Boolean).length;

  return (
    <CollapsibleSection
      title="Metadata auto-fill (Open Library)"
      icon={DownloadOutlinedIcon}
      badge={`${onCount}/2 on`}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which fields Open Library fills in automatically when you search for a Book or
        Audiobook entry. Author and Series are always filled.
      </Typography>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="body1">Release Year</Typography>
          <Typography variant="body2" color="text.secondary">
            Book only — year only, Open Library doesn&apos;t give a full date
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={releaseYear}
              onChange={(_, next) => setReleaseYear(next)}
              inputProps={{ 'aria-label': 'Auto-fill release year, on by default' }}
            />
          }
          label=""
          sx={{ mr: 0 }}
        />
      </Stack>

      <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body1">Cover image</Typography>
            <Typography variant="body2" color="text.secondary">
              On by default
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={coverImage}
                onChange={(_, next) => setCoverImage(next)}
                inputProps={{ 'aria-label': 'Auto-fill cover image, on by default' }}
              />
            }
            label=""
            sx={{ mr: 0 }}
          />
        </Stack>
        <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
          Stores Open Library&apos;s hosted image URL, not the file. Shown in Edit Entry and as a
          small thumbnail in the Library, In Progress and Wishlist lists.
        </Alert>
      </Box>
    </CollapsibleSection>
  );
}
