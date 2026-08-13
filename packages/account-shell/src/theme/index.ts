import { createTheme, Theme } from '@mui/material/styles';

/** Used before an organisation resolves, and by the public directory. */
export const DEFAULT_PRIMARY = '#1976d2';

/**
 * Build the MUI theme for an organisation.
 *
 * The account app is branded per club: the theme cannot be a module constant
 * because the primary colour only becomes known once the organisation resolves
 * (B1 — "the shell must build its MUI theme after the org resolves"). Callers
 * memoise on `primaryColor` so switching organisations re-themes without
 * rebuilding on every render.
 *
 * An invalid or missing colour falls back rather than throwing — a club with a
 * malformed branding value should look wrong, not be unreachable.
 */
export function buildTheme(primaryColor?: string | null): Theme {
  const primary = isValidHexColour(primaryColor) ? primaryColor! : DEFAULT_PRIMARY;

  return createTheme({
    palette: {
      primary: { main: primary },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontFamily: '"Sora", "Roboto", sans-serif', fontSize: '2rem', fontWeight: 600 },
      h2: { fontFamily: '"Sora", "Roboto", sans-serif', fontSize: '1.5rem', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none' },
        },
      },
    },
  });
}

export function isValidHexColour(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
