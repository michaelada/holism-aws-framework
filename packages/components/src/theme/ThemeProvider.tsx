import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { defaultTheme, darkTheme, createCustomTheme } from './defaultTheme';
import type { ThemeOptions } from '@mui/material/styles';

interface ThemeContextValue {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  setMode: (mode: 'light' | 'dark') => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface FrameworkThemeProviderProps {
  children: React.ReactNode;
  initialMode?: 'light' | 'dark';
  customTheme?: ThemeOptions;
}

/**
 * Theme provider for AWS Web Framework Components
 * Wraps MUI ThemeProvider and provides theme switching functionality
 */
export function FrameworkThemeProvider({
  children,
  initialMode = 'light',
  customTheme,
}: FrameworkThemeProviderProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(initialMode);

  const theme = useMemo(() => {
    if (customTheme) {
      return createCustomTheme(customTheme, mode);
    }
    return mode === 'dark' ? darkTheme : defaultTheme;
  }, [mode, customTheme]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const contextValue: ThemeContextValue = {
    mode,
    toggleMode,
    setMode,
    theme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a FrameworkThemeProvider');
  }
  return context;
}
