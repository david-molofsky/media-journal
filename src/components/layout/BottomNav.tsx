import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import { navItems } from './navItems';

/**
 * Persistent bottom navigation bar, the app's primary navigation on
 * mobile (UI & UX Specification, section 3). The active page is always
 * highlighted, matching the current route.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeIndex = useMemo(() => {
    const index = navItems.findIndex((item) => pathname.startsWith(item.path));
    return index === -1 ? 0 : index;
  }, [pathname]);

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
      component="nav"
      aria-label="Primary"
    >
      <BottomNavigation
        showLabels
        value={activeIndex}
        sx={{ height: 64 }}
        onChange={(_event, newIndex: number) => {
          const target = navItems[newIndex];
          if (target) {
            navigate(target.path);
          }
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={<item.icon />}
            sx={{ minWidth: 0, py: 1 }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
