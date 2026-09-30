import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { ROUTES } from '@/routes/paths';

export interface NavItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
}

/** Primary navigation. Subscription Value is available in Statistics. */
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.dashboard, icon: DashboardOutlinedIcon },
  { label: 'Journal', path: ROUTES.library, icon: CollectionsBookmarkOutlinedIcon },
  { label: 'Add', path: ROUTES.addEntry, icon: AddCircleOutlinedIcon },
  { label: 'Statistics', path: ROUTES.statistics, icon: InsightsOutlinedIcon },
  { label: 'Settings', path: ROUTES.settings, icon: SettingsOutlinedIcon },
];
