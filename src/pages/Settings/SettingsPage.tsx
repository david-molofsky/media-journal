import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { HouseholdSection } from '@/components/settings/HouseholdSection';
import { GoogleDriveSection } from '@/components/settings/GoogleDriveSection';
import { DietaryDefaultsSection } from '@/components/settings/DietaryDefaultsSection';
import { GroceryAislesSection } from '@/components/settings/GroceryAislesSection';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { PwaUpdateSection } from '@/components/settings/PwaUpdateSection';

export function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Settings
      </Typography>
      <HouseholdSection />
      <GoogleDriveSection />
      <DietaryDefaultsSection />
      <GroceryAislesSection />

      <CollapsibleSection title="About" icon={InfoOutlinedIcon}>
        <Typography variant="body2" color="text.secondary">
          Home Plate — plan meals, dodge repeats, and build the shopping list automatically.
        </Typography>
        <PwaUpdateSection />
      </CollapsibleSection>
    </Box>
  );
}
