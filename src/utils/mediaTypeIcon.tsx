import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import MicOutlinedIcon from '@mui/icons-material/MicOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import TheaterComedyOutlinedIcon from '@mui/icons-material/TheaterComedyOutlined';
import NewspaperOutlinedIcon from '@mui/icons-material/NewspaperOutlined';
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
  sports_esports: SportsEsportsOutlinedIcon,
  mic: MicOutlinedIcon,
  palette: PaletteOutlinedIcon,
  theater_comedy: TheaterComedyOutlinedIcon,
  newspaper: NewspaperOutlinedIcon,
};

export function getMediaTypeIcon(iconKey: string): SvgIconComponent {
  return iconsByKey[iconKey] ?? CategoryOutlinedIcon;
}

/** Selectable icon options for the "Add media type" form in Settings
 * (Milestone 7) — every key here is guaranteed to resolve to a real
 * icon rather than the generic fallback. */
export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'menu_book', label: 'Book' },
  { key: 'headphones', label: 'Audio' },
  { key: 'movie', label: 'Film' },
  { key: 'tv', label: 'TV' },
  { key: 'auto_stories', label: 'Comic' },
  { key: 'sports_esports', label: 'Game' },
  { key: 'mic', label: 'Podcast' },
  { key: 'palette', label: 'Art' },
  { key: 'theater_comedy', label: 'Theatre' },
  { key: 'newspaper', label: 'Magazine' },
];
