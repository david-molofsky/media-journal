import { useMemo, type ReactNode } from 'react';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import type { MediaType } from '@/models';

/**
 * Scopes the entry form to its configured media-type trim colour while
 * preserving the app's current light/dark palette and component styling.
 */
export function MediaTypeThemeProvider({
  mediaType,
  children,
}: {
  mediaType: MediaType;
  children: ReactNode;
}) {
  const parentTheme = useTheme();
  const theme = useMemo(
    () =>
      createTheme(parentTheme, {
        palette: {
          primary: {
            main: mediaType.colour,
            contrastText: '#FFFFFF',
          },
        },
      }),
    [parentTheme, mediaType.colour],
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
