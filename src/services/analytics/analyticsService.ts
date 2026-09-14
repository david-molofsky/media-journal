const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

type EventParameters = Record<
  string,
  string | number | boolean | undefined
>;

export function initialiseAnalytics(): void {
  if (!measurementId || window.gtag) return;

  window.dataLayer = window.dataLayer || [];

  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args);
  };

  // No analytics cookies until the user gives permission.
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
  window.gtag?.('event', eventName, parameters);
}

export function trackPageView(path: string): void {
  if (!measurementId) return;

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: measurementId,
  });
}
