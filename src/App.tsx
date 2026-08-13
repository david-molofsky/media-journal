import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { theme } from '@/theme/theme';
import { AppLayout } from '@/components/layout/AppLayout';
import { CookingTimerProvider } from '@/hooks/useCookingTimer';
import { PwaUpdateProvider } from '@/pwa/PwaUpdateContext';
import { WeeklyPlannerPage } from '@/pages/WeeklyPlanner/WeeklyPlannerPage';
import { CalendarPage } from '@/pages/Calendar/CalendarPage';
import { LibraryPage } from '@/pages/Library/LibraryPage';
import { MealDetailPage } from '@/pages/Library/MealDetailPage';
import { EditMealPage } from '@/pages/Library/EditMealPage';
import { ImportRecipePage } from '@/pages/Library/ImportRecipePage';
import { CookingModePage } from '@/pages/Library/CookingModePage';
import { ShoppingListPage } from '@/pages/ShoppingList/ShoppingListPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PwaUpdateProvider>
        <CookingTimerProvider>
          <HashRouter>
            <Routes>
              {/* Cooking Mode is a full-screen takeover — deliberately
                  outside AppLayout so it renders without the normal
                  header/bottom nav chrome. */}
              <Route path="/library/:mealId/cook" element={<CookingModePage />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<WeeklyPlannerPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/library/new" element={<EditMealPage />} />
                <Route path="/library/import" element={<ImportRecipePage />} />
                <Route path="/library/:mealId" element={<EditMealPage />} />
                <Route path="/library/:mealId/view" element={<MealDetailPage />} />
                <Route path="/shopping-list" element={<ShoppingListPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </CookingTimerProvider>
      </PwaUpdateProvider>
    </ThemeProvider>
  );
}
