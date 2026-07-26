import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTvTrackingMode } from '@/hooks/useTvTrackingMode';
import { useDefaultEntryStatus } from '@/hooks/useDefaultEntryStatus';
import { useNumberSetting } from '@/hooks/useNumberSetting';
import { MediaTypePicker } from '@/components/forms/MediaTypePicker';
import { EntryForm } from '@/components/forms/EntryForm';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { createEntry } from '@/services/database/entryService';
import { ROUTES } from '@/routes/paths';
import { SETTINGS_KEYS } from '@/models';
import type { MediaType } from '@/models';

/** Mirrors MediaTypePicker's TIP_MAX_SHOWS — a save counts as one of
 * the 5 shows just like an explicit dismissal (see chat). */
const TIP_MAX_SHOWS = 5;

export default function AddEntryPage() {
  const mediaTypes = useMediaTypes();
  const tvMode = useTvTrackingMode();
  const defaultStatus = useDefaultEntryStatus();
  const [selectedType, setSelectedType] = useState<MediaType | null>(null);
  const [tipShownCount, setTipShownCount] = useNumberSetting(
    SETTINGS_KEYS.addEntryTipShownCount,
    0,
  );
  const navigate = useNavigate();

  /**
   * Strip or include TV episode fields depending on the tracking mode.
   * The TV media type in the DB always carries all three fields so the
   * migration only needs to run once; the form just sees a filtered
   * view of them. This means switching modes takes effect immediately
   * without any re-migration.
   */
  const effectiveMediaType = useMemo((): MediaType | null => {
    if (!selectedType || selectedType.id !== 'tv') return selectedType;
    return {
      ...selectedType,
      fields: selectedType.fields.filter((field) =>
        tvMode === 'episode'
          ? true
          : field.key !== 'episodeStart' && field.key !== 'episodeEnd',
      ),
    };
  }, [selectedType, tvMode]);

  if (mediaTypes === undefined) {
    return <LoadingIndicator />;
  }

  if (!selectedType || !effectiveMediaType) {
    return <MediaTypePicker mediaTypes={mediaTypes} onSelect={setSelectedType} />;
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          aria-label="Back to media type selection"
          onClick={() => setSelectedType(null)}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600}>
          New {effectiveMediaType.displayName}
        </Typography>
      </Stack>
      <EntryForm
        key={`${effectiveMediaType.id}-${tvMode}-${defaultStatus}`}
        mediaType={effectiveMediaType}
        defaultStatus={defaultStatus}
        submitLabel="Save Entry"
        onSubmit={async (values) => {
          await createEntry(values);
          if (tipShownCount < TIP_MAX_SHOWS) setTipShownCount(tipShownCount + 1);
          navigate(ROUTES.library);
        }}
      />
    </Box>
  );
}
