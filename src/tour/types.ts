export interface TourStep {
  /** Unique step id. */
  id: string;
  /** Route path (matches ROUTES from '@/routes/paths') this step needs. */
  route: string;
  /**
   * data-tour-target value of the element to spotlight. Omit for
   * centered steps (welcome / done) that have no specific target.
   */
  targetId?: string;
  /** Centered card, dimmed backdrop, no spotlight cutout. */
  centered?: boolean;
  title: string;
  body: string;
  /**
   * This step advances itself automatically once the NEXT step's
   * target appears in the DOM (e.g. once the user taps "Film" and the
   * entry form mounts) — used instead of a Next button for steps that
   * require a real action the tour can't perform for them.
   */
  autoAdvanceOnNextTargetAppears?: boolean;
  /**
   * This step advances itself automatically once the app navigates
   * away from `route` on its own (e.g. AddEntryPage redirecting to
   * Library after a successful save) — used when the underlying page
   * has its own navigation side effect the tour doesn't control.
   */
  autoAdvanceOnRouteLeave?: boolean;
}
