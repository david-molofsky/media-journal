import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES } from './paths';

// Routes are lazy-loaded to keep the initial bundle small and the first
// paint fast (Technical Architecture Document, section 10).
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const LibraryPage = lazy(() => import('@/pages/Library/LibraryPage'));
const AddEntryPage = lazy(() => import('@/pages/AddEntry/AddEntryPage'));
const EditEntryPage = lazy(() => import('@/pages/EditEntry/EditEntryPage'));
const StatisticsPage = lazy(() => import('@/pages/Statistics/StatisticsPage'));
const TimelinePage = lazy(() => import('@/pages/Timeline/TimelinePage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));
const MalCallbackPage = lazy(() => import('@/pages/Settings/MalCallbackPage'));
const TraktCallbackPage = lazy(() => import('@/pages/Settings/TraktCallbackPage'));

/**
 * Top-level route table, matching the routes defined in the Technical
 * Architecture Document, section 5.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.library} element={<LibraryPage />} />
          <Route path={ROUTES.addEntry} element={<AddEntryPage />} />
          <Route path={ROUTES.editEntry} element={<EditEntryPage />} />
          <Route path={ROUTES.statistics} element={<StatisticsPage />} />
          <Route path={ROUTES.timeline} element={<TimelinePage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.malCallback} element={<MalCallbackPage />} />
          <Route path={ROUTES.traktCallback} element={<TraktCallbackPage />} />
          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
