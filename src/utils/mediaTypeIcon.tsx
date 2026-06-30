import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import type { SvgIconComponent } from '@mui/icons-material';

/**
 * Resolves a `MediaType.icon` identifier to a concrete MUI icon
 * component.
 *
 * `MediaType.icon` is stored as a plain string (per models/MediaType.ts
 * and Database Schema & Data Model, section 5) so media type
 * *configuration* stays data-only — the `mediaTypes` table never
 * references a React component directly. This lookup is the one place
 * that string gets resolved to something renderable. A media type
 * added later in Settings (Milestone 7) with an unrecognised icon key
 * falls back to a generic icon instead of breaking the picker, so the
 * UI never depends on every possible icon name being known in advance.
 */
const iconsByKey: Record<string, SvgIconComponent> = {
  menu_book: MenuBookOutlinedIcon,
  headphones: HeadphonesOutlinedIcon,
  movie: MovieOutlinedIcon,
  tv: TvOutlinedIcon,
  auto_stories: AutoStoriesOutlinedIcon,
};

export function getMediaTypeIcon(iconKey: string): SvgIconComponent {
  return iconsByKey[iconKey] ?? CategoryOutlinedIcon;
}
