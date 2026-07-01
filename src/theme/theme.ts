import { createTheme, type ThemeOptions } from '@mui/material/styles';
import type { ColorMode } from '@/models';

/**
 * Shared structural options (shape, typography, component overrides)
 * that don't vary between light and dark mode.
 */
const baseOptions: ThemeOptions = {
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: ['Roboto', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'].join(','),
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 20 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none' },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
    },
  },
};

/**
 * Creates the app theme for the given colour mode.
 *
 * Primary colour is green throughout, matching the app icon:
 *   Light — #2E7D32 (deep green, high contrast on white)
 *   Dark  — #66BB6A (lightened so it stays legible on dark surfaces
 *            without being eye-watering)
 *
 * In dark mode MUI automatically adjusts surface/divider/overlay
 * colours via its dark palette algorithm; we only need to specify the
 * backgrounds we want to override from the defaults.
 */
export function createAppTheme(mode: ColorMode) {
  return createTheme({
    ...baseOptions,
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#66BB6A' : '#2E7D32',
        dark: mode === 'dark' ? '#43A047' : '#1B5E20',
        light: mode === 'dark' ? '#A5D6A7' : '#4CAF50',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#7B1FA2',
      },
      background:
        mode === 'dark'
          ? { default: '#121212', paper: '#1E1E1E' }
          : { default: '#FFFBFE', paper: '#FFFFFF' },
    },
  });
}

/** Convenience export for callers that only ever need light mode
 * (e.g. tests, Storybook). Production runtime uses createAppTheme. */
export const theme = createAppTheme('light');
