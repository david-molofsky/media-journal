import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ViewTimelineOutlinedIcon from '@mui/icons-material/ViewTimelineOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { ROUTES } from '@/routes/paths';

export interface NavItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
}

/**
 * Primary navigation: Dashboard, Library, Add Entry, Statistics,
 * Timeline. Settings isn't here — it's reachable from the gear icon in
 * AppHeader, present on every page, so it didn't need its own bottom
 * nav slot once Timeline needed one (see chat).
 */
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.dashboard, icon: DashboardOutlinedIcon },
  { label: 'Library', path: ROUTES.library, icon: VideoLibraryOutlinedIcon },
  { label: 'Add', path: ROUTES.addEntry, icon: AddCircleOutlinedIcon },
  { label: 'Statistics', path: ROUTES.statistics, icon: InsightsOutlinedIcon },
  { label: 'Timeline', path: ROUTES.timeline, icon: ViewTimelineOutlinedIcon },
];
