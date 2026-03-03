import { createTheme } from '@mui/material/styles';

/**
 * Warm Theme for ItsPlainSailing Super Admin
 * 
 * Inspired by the marketing site design with warm orange/gold gradients,
 * clean typography, and modern aesthetics.
 * 
 * Color Palette:
 * - Primary: Orange (#FF9800) to Amber (#E65100) gradient
 * - Gold accent: #FFC107
 * - Charcoal: #1A1E2E
 * - Warm backgrounds: #FAF8F5, #F1EDE8
 */
export const warmTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FF9800', // Orange
      light: '#FFB74D',
      dark: '#F57C00',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FFC107', // Gold
      light: '#FFD54F',
      dark: '#FFA000',
      contrastText: '#1A1E2E',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    success: {
      main: '#22C55E',
      light: '#4ADE80',
      dark: '#16A34A',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
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
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '60px',
          padding: '0.85rem 2rem',
          fontSize: '0.95rem',
          fontWeight: 600,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          textTransform: 'none',
        },
        contained: {
          background: 'linear-gradient(135deg, #FF9800, #E65100)',
          color: '#ffffff',
          boxShadow: '0 8px 30px rgba(255,152,0,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #F57C00, #D84315)',
            transform: 'translateY(-2px)',
            boxShadow: '0 12px 35px rgba(255,152,0,0.35)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #FF9800, #E65100)',
          '&:hover': {
            background: 'linear-gradient(135deg, #F57C00, #D84315)',
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
            color: '#FF9800',
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
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
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
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 152, 0, 0.12)',
            color: '#FF9800',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(255, 152, 0, 0.16)',
            },
            '& .MuiListItemIcon-root': {
              color: '#FF9800',
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
        filledDefault: {
          backgroundColor: '#FFF3E0',
          color: '#E65100',
        },
        filledPrimary: {
          backgroundColor: '#FFF3E0',
          color: '#E65100',
        },
        filledSuccess: {
          backgroundColor: '#F0FDF4',
          color: '#166534',
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
