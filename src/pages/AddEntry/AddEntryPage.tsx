import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { MediaTypePicker } from '@/components/forms/MediaTypePicker';
import { EntryForm } from '@/components/forms/EntryForm';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { createEntry } from '@/services/database/entryService';
import { ROUTES } from '@/routes/paths';
import type { MediaType } from '@/models';

/**
 * Add Entry — media type selection (step 1) followed by the
 * appropriate dynamic form (step 2), per PRD section 5 and UI & UX
 * Specification section 6.
 */
export default function AddEntryPage() {
  const mediaTypes = useMediaTypes();
  const [selectedType, setSelectedType] = useState<MediaType | null>(null);
  const navigate = useNavigate();

  if (mediaTypes === undefined) {
    return <LoadingIndicator />;
  }

  if (!selectedType) {
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
          New {selectedType.displayName}
        </Typography>
      </Stack>
      <EntryForm
        key={selectedType.id}
        mediaType={selectedType}
        submitLabel="Save Entry"
        onSubmit={async (values) => {
          await createEntry(values);
          navigate(ROUTES.library);
        }}
      />
    </Box>
  );
}
