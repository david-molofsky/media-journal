import { createTheme, type ThemeOptions } from '@mui/material/styles';

/**
 * Media Journal theme.
 *
 * Styled to evoke Material Design 3: rounded cards, soft shadows, a
 * vibrant primary colour and generous spacing. Only a light theme is
 * defined for Version 1; dark mode is a planned future enhancement
 * (see UI & UX Specification, section 14) and the structure below is
 * written so a `dark` palette can be added later without touching
 * component code.
 */
const baseThemeOptions: ThemeOptions = {
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: ['Roboto', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'].join(
      ',',
    ),
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#1976D2',
    },
    secondary: {
      main: '#7B1FA2',
    },
    background: {
      default: '#FFFBFE',
      paper: '#FFFFFF',
    },
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
        root: {
          borderRadius: 20,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        // Large touch targets / accessibility (UI & UX Spec section 13).
        disableRipple: false,
      },
    },
  },
};

export const theme = createTheme(baseThemeOptions);
