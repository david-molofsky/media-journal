import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
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
 * Primary navigation: Dashboard, Journal, Add Entry, Statistics,
 * Timeline. Settings isn't here — it's reachable from the gear icon in
 * AppHeader, present on every page, so it didn't need its own bottom
 * nav slot once Timeline needed one (see chat).
 *
 * Note: label is 'Journal' (user-facing) while the underlying route,
 * page component, and folder remain LibraryPage/ROUTES.library —
 * intentional, see chat 2026-08-23 (rename scoped to visible strings only).
 *
 * Icon changed from VideoLibraryOutlined to CollectionsBookmarkOutlined
 * Aug 2026 — see chat. Chosen over a custom SVG traced from the app's
 * actual logo (spine/cover/elastic-band silhouette), which was also
 * considered and wireframed, in favor of a real, already-available
 * MUI icon.
 */
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.dashboard, icon: DashboardOutlinedIcon },
  { label: 'Journal', path: ROUTES.library, icon: CollectionsBookmarkOutlinedIcon },
  { label: 'Add', path: ROUTES.addEntry, icon: AddCircleOutlinedIcon },
  { label: 'Statistics', path: ROUTES.statistics, icon: InsightsOutlinedIcon },
  { label: 'Timeline', path: ROUTES.timeline, icon: ViewTimelineOutlinedIcon },
];
