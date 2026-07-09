import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';

interface ToggleRowProps {
  label: string;
  helperText: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, helperText, checked, onChange }: ToggleRowProps) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Box>
        <Typography variant="body1">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {helperText}
        </Typography>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(_, next) => onChange(next)}
            inputProps={{ 'aria-label': `Auto-fill ${label.toLowerCase()}` }}
          />
        }
        label=""
        sx={{ mr: 0 }}
      />
    </Stack>
  );
}

/**
 * Controls which fields ComicVine auto-fill populates for Comic
 * Issues — series/publisher come from the series search step
 * (MetadataSearch > comicVineService.searchSeries), everything else
 * from the separate "Fetch issue details" step in EntryForm
 * (comicVineService.getIssueDetails). Same persisted-in-Settings
 * convention as TmdbAutofillSection.
 *
 * All fields default to on except Cover image, which is opt-in — same
 * reasoning as TMDB's Poster toggle: it's the one field that changes
 * what an entry visually looks like, so it stays off until explicitly
 * enabled.
 *
 * Deliberately scoped to Comic Issues only — Magazine Issues has no
 * ComicVine integration (David's instruction to keep Comic and
 * Magazine changes separate unless he says otherwise).
 */
export function ComicVineAutofillSection() {
  const [publisher, setPublisher] = useBooleanSetting('autofillComicPublisher', true);
  const [issueTitle, setIssueTitle] = useBooleanSetting('autofillComicIssueTitle', true);
  const [coverDate, setCoverDate] = useBooleanSetting('autofillComicCoverDate', true);
  const [writer, setWriter] = useBooleanSetting('autofillComicWriter', true);
  const [penciller, setPenciller] = useBooleanSetting('autofillComicPenciller', true);
  const [inker, setInker] = useBooleanSetting('autofillComicInker', true);
  const [colorist, setColorist] = useBooleanSetting('autofillComicColorist', true);
  const [letterer, setLetterer] = useBooleanSetting('autofillComicLetterer', true);
  const [coverArtist, setCoverArtist] = useBooleanSetting('autofillComicCoverArtist', true);
  const [editor, setEditor] = useBooleanSetting('autofillComicEditor', true);
  const [coverImage, setCoverImage] = useBooleanSetting('autofillComicCoverImage', false);

  const onCount = [
    publisher,
    issueTitle,
    coverDate,
    writer,
    penciller,
    inker,
    colorist,
    letterer,
    coverArtist,
    editor,
    coverImage,
  ].filter(Boolean).length;

  return (
    <CollapsibleSection
      title="Metadata auto-fill (ComicVine)"
      icon={DownloadOutlinedIcon}
      badge={`${onCount}/11 on`}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which fields ComicVine fills in automatically when you search for a Comic Issue
        entry.
      </Typography>

      <Stack spacing={2}>
        <ToggleRow
          label="Publisher"
          helperText="Filled when you select a series"
          checked={publisher}
          onChange={setPublisher}
        />
        <ToggleRow
          label="Issue title"
          helperText="Filled by Fetch issue details"
          checked={issueTitle}
          onChange={setIssueTitle}
        />
        <ToggleRow
          label="Cover date"
          helperText="Filled by Fetch issue details"
          checked={coverDate}
          onChange={setCoverDate}
        />
        <ToggleRow
          label="Writer"
          helperText="Filled by Fetch issue details"
          checked={writer}
          onChange={setWriter}
        />
        <ToggleRow
          label="Penciller"
          helperText="Filled by Fetch issue details"
          checked={penciller}
          onChange={setPenciller}
        />
        <ToggleRow
          label="Inker"
          helperText="Filled by Fetch issue details"
          checked={inker}
          onChange={setInker}
        />
        <ToggleRow
          label="Colorist"
          helperText="Filled by Fetch issue details"
          checked={colorist}
          onChange={setColorist}
        />
        <ToggleRow
          label="Letterer"
          helperText="Filled by Fetch issue details"
          checked={letterer}
          onChange={setLetterer}
        />
        <ToggleRow
          label="Cover artist"
          helperText="Filled by Fetch issue details"
          checked={coverArtist}
          onChange={setCoverArtist}
        />
        <ToggleRow
          label="Editor"
          helperText="Filled by Fetch issue details"
          checked={editor}
          onChange={setEditor}
        />
      </Stack>

      <Box sx={{ mt: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body1">Cover image</Typography>
            <Typography variant="body2" color="text.secondary">
              Off by default &middot; filled by Fetch issue details
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={coverImage}
                onChange={(_, next) => setCoverImage(next)}
                inputProps={{ 'aria-label': 'Auto-fill cover image, off by default' }}
              />
            }
            label=""
            sx={{ mr: 0 }}
          />
        </Stack>
        <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
          Stores ComicVine&apos;s hosted image URL, not the file. Shown in Edit Entry only — the
          Library list and grid stay text-only either way.
        </Alert>
      </Box>
    </CollapsibleSection>
  );
}
