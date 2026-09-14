const measurementId =
  import.meta.env.VITE_GA_MEASUREMENT_ID;

const ANALYTICS_CONSENT_KEY =
  'mediaJournalAnalyticsConsent';

type EventParameters = Record<
  string,
  string | number | boolean | undefined
>;

export type EntryCreationSource =
  | 'manual'
  | 'shared_link'
  | 'relog';

export interface EntryAnalyticsValues {
  mediaType: string;
  status?: string;
  startedDate?: string;
  completedDate?: string;
  rating?: number;
  notes?: string;
  repeatConsumption?: boolean;
  tags?: string[];
  genres?: string[];
  watchedWith?: string[];
  recommendedBy?: string[];
  metadata?: Record<string, unknown>;
}

function hasAnalyticsConsent(): boolean {
  return (
    localStorage.getItem(ANALYTICS_CONSENT_KEY) ===
    'granted'
  );
}

function getPlatformSurface():
  | 'android_twa'
  | 'ios_pwa'
  | 'installed_pwa'
  | 'browser' {
  const searchParams = new URLSearchParams(
    window.location.search,
  );

  const storedSurface = localStorage.getItem(
    'mediaJournalPlatformSurface',
  );

  if (
    searchParams.get('source') === 'twa' ||
    storedSurface === 'android_twa'
  ) {
    localStorage.setItem(
      'mediaJournalPlatformSurface',
      'android_twa',
    );

    return 'android_twa';
  }

  const navigatorWithStandalone =
    navigator as Navigator & {
      standalone?: boolean;
    };

  if (navigatorWithStandalone.standalone === true) {
    return 'ios_pwa';
  }

  if (
    window.matchMedia('(display-mode: standalone)')
      .matches
  ) {
    return 'installed_pwa';
  }

  return 'browser';
}

function countPopulatedMetadata(
  metadata: Record<string, unknown> | undefined,
): number {
  if (!metadata) return 0;

  return Object.values(metadata).filter(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== '',
  ).length;
}

export function initialiseAnalytics(): void {
  if (!measurementId || window.gtag) return;

  window.dataLayer = window.dataLayer || [];

  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args);
  };

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  const script = document.createElement('script');

  script.async = true;
  script.src =
    `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

  document.head.appendChild(script);

  window.gtag('js', new Date());

  window.gtag('config', measurementId, {
    send_page_view: false,
  });
}

export function grantAnalyticsConsent(): void {
  window.gtag?.('consent', 'update', {
    analytics_storage: 'granted',
  });
}

export function denyAnalyticsConsent(): void {
  window.gtag?.('consent', 'update', {
    analytics_storage: 'denied',
  });
}

export function trackEvent(
  eventName: string,
  parameters: EventParameters = {},
): void {
  if (!hasAnalyticsConsent()) return;

  window.gtag?.('event', eventName, {
    ...parameters,
    platform_surface: getPlatformSurface(),
  });
}

export function trackPageView(path: string): void {
  if (!measurementId || !hasAnalyticsConsent()) {
    return;
  }

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    platform_surface: getPlatformSurface(),
    send_to: measurementId,
  });
}

export function trackEntryCreated(
  entry: EntryAnalyticsValues,
  options: {
    creationSource: EntryCreationSource;
    librarySizeBefore: number;
  },
): void {
  const metadata = entry.metadata ?? {};

  trackEvent('entry_created', {
    media_type: entry.mediaType,
    entry_status: entry.status ?? 'completed',
    creation_source: options.creationSource,

    is_first_entry:
      options.librarySizeBefore === 0,

    library_size_before:
      options.librarySizeBefore,

    is_repeat_consumption:
      Boolean(entry.repeatConsumption),

    has_rating:
      entry.rating !== undefined,

    has_notes:
      Boolean(entry.notes?.trim()),

    has_started_date:
      Boolean(entry.startedDate),

    has_completed_date:
      Boolean(entry.completedDate),

    tag_count:
      entry.tags?.length ?? 0,

    genre_count:
      entry.genres?.length ?? 0,

    watched_with_count:
      entry.watchedWith?.length ?? 0,

    recommended_by_count:
      entry.recommendedBy?.length ?? 0,

    populated_metadata_count:
      countPopulatedMetadata(metadata),

    has_source:
      typeof metadata.source === 'string' &&
      metadata.source.trim().length > 0,

    has_cover_image:
      Boolean(
        metadata.posterPath ||
        metadata.coverImagePath,
      ),

    used_metadata_autofill:
      Boolean(
        metadata.tmdbId ||
        metadata.openLibraryKey ||
        metadata.comicVineVolumeId,
      ),
  });
}

export function trackEntryUpdated(
  entry: EntryAnalyticsValues,
  changedFields: string[],
): void {
  trackEvent('entry_updated', {
    media_type: entry.mediaType,
    entry_status: entry.status ?? 'completed',
    changed_field_count: changedFields.length,
    changed_fields: changedFields.join(','),
  });
}

export function trackEntryStatusChanged(
  mediaType: string,
  previousStatus: string,
  newStatus: string,
): void {
  trackEvent('entry_status_changed', {
    media_type: mediaType,
    previous_status: previousStatus,
    new_status: newStatus,
  });
}

export function trackEntryDeleted(
  mediaType: string,
  status: string,
): void {
  trackEvent('entry_deleted', {
    media_type: mediaType,
    entry_status: status,
  });
}
