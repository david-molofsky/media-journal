import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
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

/**
 * Primary navigation, per UI & UX Specification section 3:
 * Dashboard, Library, Add Entry, Statistics, Settings.
 */
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.dashboard, icon: DashboardOutlinedIcon },
  { label: 'Library', path: ROUTES.library, icon: VideoLibraryOutlinedIcon },
  { label: 'Add', path: ROUTES.addEntry, icon: AddCircleOutlinedIcon },
  { label: 'Statistics', path: ROUTES.statistics, icon: InsightsOutlinedIcon },
  { label: 'Settings', path: ROUTES.settings, icon: SettingsOutlinedIcon },
];
