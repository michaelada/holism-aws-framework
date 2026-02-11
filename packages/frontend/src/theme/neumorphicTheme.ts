import { createTheme } from '@mui/material/styles';

// Neumorphic theme inspired by the provided CSS
export const neumorphicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#009087',
      light: '#00b3a8',
      dark: '#006d66',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#090909',
      light: '#666666',
      dark: '#000000',
      contrastText: '#ffffff',
    },
    background: {
      default: '#e8e8e8',
      paper: '#f5f5f5',
    },
    text: {
      primary: '#090909',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      fontSize: '1rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          position: 'relative',
          overflow: 'hidden',
          padding: '0.7em 1.7em',
          fontSize: '1rem',
          borderRadius: '0.5em',
          transition: 'all 0.2s ease-in',
          zIndex: 1,
          '&::before': {
            content: '""',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%) scaleY(1) scaleX(1.25)',
            top: '100%',
            width: '140%',
            height: '180%',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '50%',
            display: 'block',
            transition: 'all 0.5s 0.1s cubic-bezier(0.55, 0, 0.1, 1)',
            zIndex: -1,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '55%',
            transform: 'translateX(-50%) scaleY(1) scaleX(1.45)',
            top: '180%',
            width: '160%',
            height: '190%',
            backgroundColor: '#009087',
            borderRadius: '50%',
            display: 'block',
            transition: 'all 0.5s 0.1s cubic-bezier(0.55, 0, 0.1, 1)',
            zIndex: -1,
          },
          '&:hover::before': {
            top: '-35%',
            backgroundColor: '#009087',
            color: '#fff',
            transform: 'translateX(-50%) scaleY(1.3) scaleX(0.8)',
          },
          '&:hover::after': {
            top: '-45%',
            backgroundColor: '#009087',
            color: '#fff',
            transform: 'translateX(-50%) scaleY(1.3) scaleX(0.8)',
          },
        },
        contained: {
          backgroundColor: '#e8e8e8',
          color: '#090909',
          border: '1px solid #e8e8e8',
          boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
          '&:hover': {
            backgroundColor: '#e8e8e8',
            color: '#ffffff',
            border: '1px solid #009087',
            boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
          },
          '&:active': {
            color: '#666',
            boxShadow: 'inset 4px 4px 12px #c5c5c5, inset -4px -4px 12px #ffffff',
          },
        },
        containedPrimary: {
          backgroundColor: '#e8e8e8',
          color: '#090909',
          border: '1px solid #e8e8e8',
          '&:hover': {
            backgroundColor: '#e8e8e8',
            color: '#ffffff',
            border: '1px solid #009087',
          },
        },
        outlined: {
          backgroundColor: '#e8e8e8',
          border: '1px solid #009087',
          boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
          '&:hover': {
            backgroundColor: '#e8e8e8',
            border: '1px solid #009087',
            color: '#ffffff',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(0, 144, 135, 0.08)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#e8e8e8',
          boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
          borderRadius: '1em',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#e8e8e8',
          boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
        },
        elevation1: {
          boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
        },
        elevation2: {
          boxShadow: '8px 8px 16px #c5c5c5, -8px -8px 16px #ffffff',
        },
        elevation3: {
          boxShadow: '10px 10px 20px #c5c5c5, -10px -10px 20px #ffffff',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#e8e8e8',
            boxShadow: 'inset 4px 4px 8px #c5c5c5, inset -4px -4px 8px #ffffff',
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: '#009087',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#009087',
            },
          }
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#e8e8e8',
          boxShadow: 'inset 4px 4px 8px #c5c5c5, inset -4px -4px 8px #ffffff',
          '& fieldset': {
            borderColor: 'transparent',
          },
          '&:hover fieldset': {
            borderColor: '#009087',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#009087',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#e8e8e8',
          color: '#090909',
          boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #d0d0d0',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#e8e8e8',
        },
      },
    },
  },
});
