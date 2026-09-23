import { ROUTES } from '@/routes/paths';
import type { TourStep } from './types';

/**
 * Linear step order — the tour always moves forward/back through this
 * array, it never jumps around, but any step can be skipped
 * individually (advances one step) or the whole tour ended early via
 * the close icon.
 *
 * The Add Entry steps come before Dashboard/Journal/Statistics
 * deliberately: those pages show empty-state placeholders instead of
 * real content until at least one entry exists, so we create one
 * first and spotlight populated pages afterwards (see chat).
 */
export const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    route: ROUTES.dashboard,
    centered: true,
    title: 'Welcome to Media Journal',
    body: "Keep everything you watch, read and listen to in one personal journal. We'll show you around by creating your first entry.",
  },
  {
    id: 'add-1',
    route: ROUTES.addEntry,
    targetId: 'add-media-type-film',
    autoAdvanceOnNextTargetAppears: true,
    title: "Let's log a Film",
    body: "Tap Film to get started — we'll pull in the poster and details automatically once you search for a title.",
  },
  {
    id: 'add-2',
    route: ROUTES.addEntry,
    targetId: 'add-rating-notes',
    autoAdvanceOnRouteLeave: true,
    title: 'Add notes & save',
    body: "Set a status, jot down notes, and hit Save Entry — that's your first entry in the Journal.",
  },
  {
    id: 'dashboard',
    route: ROUTES.dashboard,
    targetId: 'dashboard-stats',
    title: 'Your Dashboard',
    body: 'At-a-glance stats: total entries, monthly activity, and a rolling 12-month chart.',
  },
  {
    id: 'journal',
    route: ROUTES.library,
    targetId: 'journal-list',
    title: 'Your Journal',
    body: 'Every entry lives here. Filter by type, search, and tap any entry to see details or edit.',
  },
  {
    id: 'stats',
    route: ROUTES.statistics,
    targetId: 'stats-subscription-score',
    title: 'Subscription Score',
    body: 'Tap this tile to see whether your streaming subscriptions are earning their keep, based on what you actually watch.',
  },
  {
    id: 'subscriptions',
    route: ROUTES.subscriptions,
    targetId: 'subscriptions-calculator',
    title: 'Subscriptions Calculator',
    body: "Flag the services you pay for in Settings and we'll show cost-per-watch and flag your best and worst value here.",
  },
  {
    id: 'settings-backup',
    route: ROUTES.settings,
    targetId: 'settings-backup',
    title: 'Back up to Google Drive',
    body: 'Connect Google Drive so your whole library is backed up and easy to restore if you switch devices.',
  },
  {
    id: 'settings-media-types',
    route: ROUTES.settings,
    targetId: 'settings-media-types',
    title: 'More media types',
    body: 'Turn on video games, manga, podcasts and more here any time — off by default to keep Add Entry short.',
  },
  {
    id: 'done',
    route: ROUTES.dashboard,
    centered: true,
    title: "You're all set",
    body: 'You can replay this tour anytime from Settings → Guided Tour.',
  },
];
