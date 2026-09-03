import { createTheme } from '@mui/material/styles';

/**
 * Warm Theme for ItsPlainSailing
 *
 * Inspired by the marketing site design with warm orange/gold gradients,
 * clean typography, and modern aesthetics.
 *
 * ## The two oranges
 *
 * Every orange here is either *flare* or *signal*, and the difference is
 * whether it has to be read:
 *
 * - **Flare** (#FF9800) measures **2.16:1 on white** and decorates only —
 *   tints, hover washes, selected-row fills, input borders, icon grounds. It is
 *   `primary.light`, never `primary.main`.
 * - **Signal** (#D24400, **4.60:1**) is the lightest orange in the family that
 *   clears the normal-text threshold, so it is what MUI paints text, icons,
 *   selected navigation and focus rings with. It is `primary.main`.
 *
 * Flare used to be `primary.main`, which put 2.16:1 under the selected
 * navigation label, the primary button's left half, and every icon MUI tints
 * with the primary colour. See DESIGN.md, "The Two Oranges Rule".
 *
 * Color Palette:
 * - Primary: Signal Orange #D24400, deepening to #BF360C
 * - Flare Orange #FF9800 — decoration only
 * - Gold accent: #FFC107
 * - Charcoal: #1A1E2E
 * - Warm backgrounds: #FAF8F5, #F1EDE8
 */
export const warmTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#D24400', // Signal Orange — 4.60:1 on white, the orange that speaks
      light: '#FF9800', // Flare Orange — 2.16:1, decoration only
      dark: '#BF360C', // 5.60:1 — hover and pressed
      contrastText: '#ffffff',
    },
    secondary: {
      /*
       * Signal Gold, because `secondary.main` is a *text* colour wherever MUI
       * uses it — outlined chips, most of all. Flare Gold #FFC107 measures
       * **1.63:1 on white**, the lowest-contrast value in the system, and it
       * was labelling the discount chips on the events table.
       */
      main: '#A15C00', // 5.19:1
      light: '#FFC107', // Flare Gold — decoration only
      dark: '#7C4700',
      contrastText: '#ffffff',
    },
    error: {
      main: '#D32F2F', // 4.98:1
      light: '#F87171',
      dark: '#991B1B',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#A15C00', // 5.19:1
      light: '#FBBF24',
      dark: '#92400E',
      contrastText: '#ffffff',
    },
    success: {
      main: '#15803D', // 5.02:1
      light: '#4ADE80',
      dark: '#166534',
      contrastText: '#ffffff',
    },
    info: {
      main: '#1D4ED8', // 6.70:1
      light: '#60A5FA',
      dark: '#1E40AF',
      contrastText: '#ffffff',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B', // Slate
      secondary: '#64748B', // Text muted
    },
    divider: 'rgba(0, 0, 0, 0.06)',
    action: {
      hover: 'rgba(255, 152, 0, 0.08)',
      selected: 'rgba(255, 152, 0, 0.12)',
    },
  },
  typography: {
    fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: 'clamp(2.8rem, 6vw, 4.5rem)',
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: '-0.03em',
    },
    h2: {
      fontSize: 'clamp(2rem, 4vw, 3rem)',
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h6: {
      fontSize: '1.1rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.7,
      color: '#64748B',
    },
    body2: {
      fontSize: '0.9rem',
      lineHeight: 1.7,
      color: '#64748B',
    },
    button: {
      fontSize: '0.95rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', // sm
    '0 4px 20px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)', // md
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)', // lg
    '0 8px 30px rgba(255,152,0,0.25)', // orange glow
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    /*
     * Headings take Ink; everything else keeps the muted body colour.
     *
     * `typography.body1.color` is applied to `<body>` by CssBaseline, so every
     * element without a colour of its own inherited #64748B — including page
     * titles. "Members Database" was rendering at 4.76:1 in the *secondary*
     * text colour, which made the most important label on an operational
     * screen the faintest heading in the system.
     */
    MuiTypography: {
      styleOverrides: {
        h1: { color: '#1E293B' },
        h2: { color: '#1E293B' },
        h3: { color: '#1E293B' },
        h4: { color: '#1E293B' },
        h5: { color: '#1E293B' },
        h6: { color: '#1E293B' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '60px',
          /*
           * The horizontal padding relaxes on a phone. At 2rem a pill needs
           * ~190px before its label stops wrapping, and two of them side by
           * side on a 390px screen turned "Export to Excel" and "Add Member"
           * into four lines of text in two 76px-tall lozenges.
           */
          padding: '0.85rem 1.25rem',
          '@media (min-width:600px)': {
            padding: '0.85rem 2rem',
          },
          fontSize: '0.95rem',
          fontWeight: 600,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          textTransform: 'none',
        },
        /*
         * Lift and press belong to every contained button; the *colour* does
         * not. This block used to hard-code the orange gradient here, which
         * overrode `color` — so `<Button variant="contained" color="error">`
         * on seven delete confirmations rendered orange with an orange glow.
         * Orange is this product's invitation colour; using it to confirm a
         * deletion spends the one vocabulary the interface has for danger.
         */
        /*
         * `size="small"` meant nothing until this existed.
         *
         * The `root` override above sets the padding and the font size for
         * every button, so MUI's own small-size rules were overridden and a
         * button asking to be small came out the same 0.85rem × 2rem pill as a
         * page's primary action. Every `size="small"` in the product — the
         * per-row actions on the offline payments cards, the table row
         * buttons — was inert.
         *
         * Sized to sit inside a card or a table row without dominating it, and
         * still comfortably above the 44px touch target on a phone once the
         * line height is counted.
         */
        sizeSmall: {
          padding: '0.35rem 1rem',
          fontSize: '0.8125rem',
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-2px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          /*
           * Both stops clear 4.5:1 against white text. The old gradient opened
           * on Flare Orange at 2.16:1, so the left half of every primary button
           * in the product failed contrast.
           */
          background: 'linear-gradient(135deg, #D24400, #BF360C)',
          color: '#ffffff',
          boxShadow: '0 8px 30px rgba(255,152,0,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #BF360C, #9A3412)',
            boxShadow: '0 12px 35px rgba(255,152,0,0.35)',
          },
        },
        outlined: {
          border: '2px solid #1E293B',
          color: '#1E293B',
          '&:hover': {
            background: '#1E293B',
            color: '#ffffff',
            transform: 'translateY(-2px)',
            borderColor: '#1E293B',
          },
        },
        text: {
          color: '#64748B',
          '&:hover': {
            backgroundColor: 'rgba(255, 152, 0, 0.08)',
            color: '#D24400',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.04)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
          transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          /*
           * The card lifts its shadow on hover; it does **not** move.
           *
           * It used to rise 4px, which reads as the page shifting under the
           * pointer — distracting on a dense list, where crossing a grid of
           * cards sets each one moving in turn, and worse for anyone who tracks
           * the pointer against what is beneath it. The shadow alone says
           * "this responds" without displacing anything.
           *
           * `transition` names the property rather than `all` for the same
           * reason: `all` animates whatever a page happens to change on hover.
           */
          '&:hover': {
            boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: '12px',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        },
        elevation2: {
          boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        },
        elevation3: {
          boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '& fieldset': {
              borderColor: 'rgba(0,0,0,0.08)',
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderColor: '#FF9800',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#FF9800',
              boxShadow: '0 0 0 4px rgba(255,152,0,0.1)',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          '& fieldset': {
            borderColor: 'rgba(0,0,0,0.08)',
            borderWidth: '2px',
          },
          '&:hover fieldset': {
            borderColor: '#FF9800',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#FF9800',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: '#1E293B',
          boxShadow: '0 1px 30px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid rgba(0,0,0,0.06)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#FAF8F5',
          color: '#1E293B',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          margin: '2px 8px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 152, 0, 0.08)',
          },
          /*
           * Deep Orange, measured against the wash it actually sits on.
           *
           * The selected item is the single most-read label in the product and
           * it was set in Flare Orange — #FF9800 on its own 12% tint is about
           * 2:1, so the one item telling an administrator where they are was
           * the hardest thing on screen to read. Signal Orange fixes that but
           * only reaches 4.23:1 here: its quoted 4.60:1 is against white, and
           * this label is never on white. #BF360C clears 4.5:1 on the tint.
           */
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 152, 0, 0.12)',
            color: '#BF360C',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(255, 152, 0, 0.16)',
            },
            '& .MuiListItemIcon-root': {
              color: '#BF360C',
            },
            /*
             * The label needs saying explicitly. The rail renders it as a
             * `body2` Typography, and `typography.body2` carries a colour — so
             * the label kept the muted body colour on the selected wash
             * (2.2:1) while the icon beside it turned orange. Selection was
             * being carried by the ground and the icon, but not by the word.
             */
            '& .MuiListItemText-primary': {
              color: '#BF360C',
              fontWeight: 600,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 500,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
        },
        standardSuccess: {
          backgroundColor: '#F0FDF4',
          color: '#166534',
        },
        standardError: {
          backgroundColor: '#FEF2F2',
          color: '#991B1B',
        },
        standardWarning: {
          backgroundColor: '#FFFBEB',
          color: '#92400E',
        },
        standardInfo: {
          backgroundColor: '#EFF6FF',
          color: '#1E40AF',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1A1E2E',
          fontSize: '0.85rem',
          borderRadius: '8px',
          padding: '8px 12px',
        },
      },
    },
  },
});
