import { createTheme } from '@mui/material/styles';

/**
 * Warm theme for the Its Plain Sailing platform admin.
 *
 * A tool-shaped derivation of the marketing site's palette — not a copy of it.
 * The marketing site sells; this surface is operated all day by a handful of
 * staff, so the decoration that works on a landing page (pill buttons, gradient
 * fills, hover lift, glow shadows) is deliberately absent here. What carries
 * over is the palette and the Sora face; what changes is density, radius and
 * restraint.
 *
 * Rules this theme holds to:
 * - Orange means "primary action" or "current selection". Never decoration.
 * - `primary.main` is dark enough to carry white text at 4.5:1. The lighter
 *   brand orange lives on as `primary.light` for tints and accents, where it
 *   never has to pass a contrast check.
 * - The type ramp is a fixed rem scale with a ~1.12 step. Product UI is viewed
 *   at consistent DPI and has many more type roles than a brand page, so fluid
 *   `clamp()` headings and exaggerated contrast only create noise.
 * - Button size props work. Overriding padding on `MuiButton.root` beats
 *   `sizeSmall`, so each size is declared explicitly instead.
 */
export const warmTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      // Amber 900. 4.6:1 on white, so contained buttons and primary text
      // affordances meet WCAG AA. The brighter #FF9800 fails at 2.1:1 and is
      // kept below as `light`, for tints only.
      main: '#E65100',
      light: '#FF9800',
      dark: '#BF360C',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#B26A00', // Gold, darkened to carry white text
      light: '#FFC107',
      dark: '#8D5300',
      contrastText: '#ffffff',
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#B71C1C',
    },
    warning: {
      main: '#B26A00',
      light: '#F59E0B',
      dark: '#8D5300',
    },
    success: {
      main: '#15803D',
      light: '#22C55E',
      dark: '#166534',
    },
    info: {
      main: '#1D4ED8',
      light: '#3B82F6',
      dark: '#1E3A8A',
    },
    background: {
      // A second, warmer neutral layer for chrome (nav rail, toolbars, table
      // heads) so panels read as distinct from content without a border.
      default: '#FAF8F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#5A6779', // 5.3:1 on white and 5.0:1 on the warm neutral
    },
    divider: 'rgba(15, 23, 42, 0.10)',
    action: {
      hover: 'rgba(230, 81, 0, 0.06)',
      selected: 'rgba(230, 81, 0, 0.10)',
    },
  },
  typography: {
    fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    // Fixed rem scale, ~1.12 step. h1 is the page title and is used; the old
    // clamp()-sized display pair was defined here and referenced nowhere.
    h1: {
      fontSize: '1.75rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.3125rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.1875rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h5: {
      fontSize: '1.0625rem',
      fontWeight: 600,
      lineHeight: 1.35,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    subtitle2: {
      fontSize: '0.8125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      // Deliberately no colour: body1 is primary content and must inherit
      // text.primary. The previous theme muted every body1 in the app.
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(15,23,42,0.06), 0 1px 1px rgba(15,23,42,0.04)',
    '0 2px 6px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
    '0 6px 16px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
    '0 8px 24px rgba(15,23,42,0.10), 0 3px 8px rgba(15,23,42,0.04)',
    '0 8px 24px rgba(15,23,42,0.10), 0 3px 8px rgba(15,23,42,0.04)',
    '0 10px 28px rgba(15,23,42,0.10), 0 4px 10px rgba(15,23,42,0.04)',
    '0 10px 28px rgba(15,23,42,0.10), 0 4px 10px rgba(15,23,42,0.04)',
    '0 12px 32px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.05)',
    '0 12px 32px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.05)',
    '0 12px 32px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.05)',
    '0 14px 36px rgba(15,23,42,0.12), 0 5px 14px rgba(15,23,42,0.05)',
    '0 14px 36px rgba(15,23,42,0.12), 0 5px 14px rgba(15,23,42,0.05)',
    '0 14px 36px rgba(15,23,42,0.12), 0 5px 14px rgba(15,23,42,0.05)',
    '0 16px 40px rgba(15,23,42,0.14), 0 6px 16px rgba(15,23,42,0.05)',
    '0 16px 40px rgba(15,23,42,0.14), 0 6px 16px rgba(15,23,42,0.05)',
    '0 16px 40px rgba(15,23,42,0.14), 0 6px 16px rgba(15,23,42,0.05)',
    '0 18px 44px rgba(15,23,42,0.14), 0 6px 18px rgba(15,23,42,0.05)',
    '0 18px 44px rgba(15,23,42,0.14), 0 6px 18px rgba(15,23,42,0.05)',
    '0 18px 44px rgba(15,23,42,0.14), 0 6px 18px rgba(15,23,42,0.05)',
    '0 20px 48px rgba(15,23,42,0.16), 0 8px 20px rgba(15,23,42,0.06)',
    '0 20px 48px rgba(15,23,42,0.16), 0 8px 20px rgba(15,23,42,0.06)',
    '0 20px 48px rgba(15,23,42,0.16), 0 8px 20px rgba(15,23,42,0.06)',
    '0 24px 56px rgba(15,23,42,0.16), 0 10px 24px rgba(15,23,42,0.06)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        // A visible focus ring everywhere, in the brand colour rather than the
        // UA default, so keyboard position is never ambiguous.
        ':focus-visible': {
          outline: '2px solid #E65100',
          outlineOffset: '2px',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          textTransform: 'none',
          transition: 'background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out',
        },
        // Declared per size so `size="small"` is honoured. Small still clears
        // the 32px dense-toolbar height; medium clears 40px.
        sizeSmall: { padding: '0.25rem 0.75rem', fontSize: '0.8125rem' },
        sizeMedium: { padding: '0.5rem 1.25rem' },
        sizeLarge: { padding: '0.625rem 1.5rem', fontSize: '0.9375rem' },
        contained: {
          '&:hover': { boxShadow: 'none' },
        },
        outlined: {
          borderWidth: '1px',
          '&:hover': { borderWidth: '1px' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow: 'none',
          // No hover lift: nothing on this surface is a clickable card by
          // default, and a card that rises under the pointer promises an
          // affordance it does not have.
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { paddingBottom: 0 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: { borderRadius: 10 },
        elevation1: { boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 1px 1px rgba(15,23,42,0.04)' },
        elevation2: { boxShadow: '0 2px 6px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)' },
        elevation3: { boxShadow: '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            '& fieldset': {
              borderColor: 'rgba(15,23,42,0.16)',
              borderWidth: '1px',
            },
            '&:hover fieldset': { borderColor: 'rgba(15,23,42,0.32)' },
            '&.Mui-focused fieldset': {
              borderColor: '#E65100',
              borderWidth: '2px',
            },
            '&.Mui-error fieldset': { borderColor: '#D32F2F' },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#1E293B',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(15,23,42,0.10)',
          // No backdrop-filter: this bar never has content scrolling beneath
          // it, so the blur was paying GPU cost for an invisible effect.
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FAF8F5',
          borderRight: '1px solid rgba(15,23,42,0.10)',
        },
      },
    },
    MuiTable: {
      defaultProps: { size: 'small' },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#FAF8F5',
          color: '#1E293B',
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 'none' },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&.Mui-selected': {
            backgroundColor: 'rgba(230, 81, 0, 0.10)',
            color: '#E65100',
            fontWeight: 600,
            '&:hover': { backgroundColor: 'rgba(230, 81, 0, 0.14)' },
            '& .MuiListItemIcon-root': { color: '#E65100' },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        // Every semantic chip pairs a tinted ground with a text colour that
        // clears 4.5:1 on it. Written as nested selectors rather than
        // `filledSuccess`-style slots because MUI v5 only types a `filled`
        // override for primary and secondary.
        root: {
          borderRadius: 6,
          fontWeight: 500,
          '&.MuiChip-filledDefault': { backgroundColor: '#EEF1F5', color: '#3F4B5B' },
          '&.MuiChip-filledPrimary': { backgroundColor: '#FFF3E0', color: '#9A3B00' },
          '&.MuiChip-filledSuccess': { backgroundColor: '#F0FDF4', color: '#166534' },
          '&.MuiChip-filledError': { backgroundColor: '#FEF2F2', color: '#991B1B' },
          '&.MuiChip-filledWarning': { backgroundColor: '#FFFBEB', color: '#854D0E' },
          '&.MuiChip-filledInfo': { backgroundColor: '#EFF6FF', color: '#1E40AF' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
        standardSuccess: { backgroundColor: '#F0FDF4', color: '#166534' },
        standardError: { backgroundColor: '#FEF2F2', color: '#991B1B' },
        standardWarning: { backgroundColor: '#FFFBEB', color: '#854D0E' },
        standardInfo: { backgroundColor: '#EFF6FF', color: '#1E40AF' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1A1E2E',
          fontSize: '0.8125rem',
          borderRadius: 6,
          padding: '6px 10px',
        },
      },
    },
  },
});
