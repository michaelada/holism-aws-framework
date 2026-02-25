import React, { useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import axios from 'axios';
import { 
  OnboardingContext, 
  OnboardingContextValue, 
  OnboardingPreferences, 
  ModuleId,
  DEFAULT_PREFERENCES 
} from './OnboardingContext';
import { AuthTokenContext } from '@aws-web-framework/orgadmin-core';
import { WelcomeDialog } from '../components/WelcomeDialog';
import { HelpDrawer } from '../components/HelpDrawer';

interface OnboardingProviderProps {
  children: ReactNode;
}

/**
 * OnboardingProvider Component
 * 
 * Provides onboarding state and actions to the application.
 * Manages welcome dialog, module introduction dialogs, and help drawer state.
 * Loads and persists user preferences via backend API.
 * 
 * Requirements: 1.3, 1.5, 2.3, 2.4, 4.1, 4.2, 4.5
 */
export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  // State
  const [preferences, setPreferences] = useState<OnboardingPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
  const [moduleIntroDialogOpen, setModuleIntroDialogOpen] = useState(false);
  const [currentModule, setCurrentModule] = useState<ModuleId | null>(null);
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  
  // Cache state to prevent repeated API calls
  // Requirements: Performance - 21.3
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  
  // Track if welcome dialog has been shown this session
  // Prevents dialog from re-appearing after temporary dismissal
  const [welcomeShownThisSession, setWelcomeShownThisSession] = useState(false);

  // Get auth token from context
  const getToken = useContext(AuthTokenContext);

  /**
   * Load user preferences from backend on mount
   * Implements preference caching to avoid repeated API calls
   * Requirements: 4.2, Performance - 21.3
   */
  useEffect(() => {
    // Skip if preferences already loaded (cache hit)
    if (preferencesLoaded) {
      return;
    }

    const loadPreferences = async () => {
      // Only load preferences if we have a token getter
      if (!getToken) {
        console.log('[OnboardingProvider] No getToken function, using defaults');
        setLoading(false);
        setPreferencesLoaded(true);
        return;
      }

      try {
        const token = getToken();
        if (!token) {
          console.warn('[OnboardingProvider] No auth token available, using default preferences');
          setLoading(false);
          setPreferencesLoaded(true);
          return;
        }

        console.log('[OnboardingProvider] Loading preferences from backend');
        const response = await axios.get('/api/user-preferences/onboarding', {
          baseURL: import.meta.env.VITE_API_BASE_URL,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        });

        console.log('[OnboardingProvider] Loaded preferences:', response.data);
        if (response.data.success && response.data.data) {
          setPreferences(response.data.data);
        }
        
        // Mark preferences as loaded (cache populated)
        setPreferencesLoaded(true);
      } catch (error) {
        // Fail-safe: If preference loading fails, use defaults
        // This ensures the welcome dialog shows by default
        console.error('[OnboardingProvider] Failed to load onboarding preferences:', error);
        if (axios.isAxiosError(error)) {
          console.error('[OnboardingProvider] Response data:', error.response?.data);
          console.error('[OnboardingProvider] Response status:', error.response?.status);
        }
        setPreferences(DEFAULT_PREFERENCES);
        setPreferencesLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [getToken, preferencesLoaded]);

  /**
   * Show welcome dialog after preferences are loaded
   * Only shows once per session unless permanently dismissed
   * Requirements: 1.1, 1.5
   */
  useEffect(() => {
    if (!loading && !preferences.welcomeDismissed && !welcomeShownThisSession) {
      // Set welcome dialog open immediately to prevent race conditions
      // This ensures checkModuleVisit sees the correct state
      setWelcomeDialogOpen(true);
      setWelcomeShownThisSession(true);
    } else if (!loading && preferences.welcomeDismissed) {
      // Ensure welcome dialog is closed if preferences indicate it was dismissed
      setWelcomeDialogOpen(false);
    }
  }, [loading, preferences.welcomeDismissed, welcomeShownThisSession]);

  /**
   * Dismiss the welcome dialog
   * Optimistically updates cache and persists to backend
   * Requirements: 1.3, 4.1, Performance - 21.3
   */
  const dismissWelcomeDialog = useCallback(async (dontShowAgain: boolean) => {
    console.log('[OnboardingProvider] dismissWelcomeDialog called', { dontShowAgain });
    setWelcomeDialogOpen(false);

    if (dontShowAgain && getToken) {
      // Optimistically update cache immediately for better UX
      setPreferences(prev => ({
        ...prev,
        welcomeDismissed: true,
      }));

      try {
        const token = getToken();
        if (!token) {
          console.warn('No auth token available, cannot save preference');
          // Revert optimistic update on failure
          setPreferences(prev => ({
            ...prev,
            welcomeDismissed: false,
          }));
          return;
        }

        console.log('[OnboardingProvider] Saving welcome dismissed preference to backend');
        const response = await axios.put(
          '/api/user-preferences/onboarding',
          { welcomeDismissed: true },
          {
            baseURL: import.meta.env.VITE_API_BASE_URL,
            headers: {
              Authorization: `Bearer ${token}`,
            },
            withCredentials: true,
          }
        );
        console.log('[OnboardingProvider] Successfully saved preference', response.data);

        // Cache remains updated - no need to reload from API
      } catch (error) {
        // Log error and revert optimistic update
        console.error('[OnboardingProvider] Failed to save welcome dialog preference:', error);
        if (axios.isAxiosError(error)) {
          console.error('[OnboardingProvider] Response data:', error.response?.data);
          console.error('[OnboardingProvider] Response status:', error.response?.status);
        }
        setPreferences(prev => ({
          ...prev,
          welcomeDismissed: false,
        }));
      }
    }
  }, [getToken]);

  /**
   * Dismiss a module introduction dialog
   * Optimistically updates cache and persists to backend
   * Requirements: 2.3, 4.1, Performance - 21.3
   */
  const dismissModuleIntro = useCallback(async (moduleId: ModuleId) => {
    setModuleIntroDialogOpen(false);
    setCurrentModule(null);

    if (!getToken) {
      console.warn('No auth token available, cannot save preference');
      return;
    }

    // Add module to visited list (merge with existing)
    const updatedModulesVisited = [...new Set([...preferences.modulesVisited, moduleId])];

    // Optimistically update cache immediately for better UX
    setPreferences(prev => ({
      ...prev,
      modulesVisited: updatedModulesVisited,
    }));

    try {
      const token = getToken();
      if (!token) {
        console.warn('No auth token available, cannot save preference');
        // Revert optimistic update on failure
        setPreferences(prev => ({
          ...prev,
          modulesVisited: preferences.modulesVisited,
        }));
        return;
      }

      await axios.put(
        '/api/user-preferences/onboarding',
        { modulesVisited: updatedModulesVisited },
        {
          baseURL: import.meta.env.VITE_API_BASE_URL,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        }
      );

      // Cache remains updated - no need to reload from API
    } catch (error) {
      // Log error and revert optimistic update
      console.error('Failed to save module intro preference:', error);
      setPreferences(prev => ({
        ...prev,
        modulesVisited: preferences.modulesVisited,
      }));
    }
  }, [getToken, preferences.modulesVisited]);

  /**
   * Check if a module has been visited and show introduction if needed
   * 
   * Dialog Priority Logic (Requirement 6.3):
   * 1. Welcome dialog has highest priority - module intros wait until it's dismissed
   * 2. Only one dialog displays at a time - prevents multiple dialogs from showing simultaneously
   * 3. Module intros only show for unvisited modules after welcome dialog is dismissed
   * 
   * Requirements: 2.1, 2.4, 6.3
   */
  const checkModuleVisit = useCallback((moduleId: ModuleId) => {
    // Don't show module intro if:
    // - Still loading preferences (wait for backend data)
    // - Welcome dialog is currently open (priority - welcome must be dismissed first)
    // - Module already visited (user has seen this intro before)
    // - Another module intro is already open (only one dialog at a time)
    if (
      loading ||
      welcomeDialogOpen ||
      preferences.modulesVisited.includes(moduleId) ||
      moduleIntroDialogOpen
    ) {
      return;
    }

    // Show module introduction
    setCurrentModule(moduleId);
    setModuleIntroDialogOpen(true);
  }, [loading, welcomeDialogOpen, preferences.modulesVisited, moduleIntroDialogOpen]);

  /**
   * Toggle the help drawer open/closed
   * Requirements: 3.1, 3.4
   */
  const toggleHelpDrawer = useCallback(() => {
    setHelpDrawerOpen(prev => !prev);
  }, []);
  
  /**
   * Set the current module for help context (without triggering intro dialog)
   * Requirements: 3.2, 3.3
   */
  const setCurrentModuleForHelp = useCallback((moduleId: ModuleId | null) => {
    setCurrentModule(moduleId);
  }, []);

  /**
   * Global keyboard shortcut handler for help drawer (Shift+?)
   * Requirements: 6.1, Accessibility
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Shift+? (which is Shift+/ on most keyboards)
      if (event.shiftKey && event.key === '?') {
        event.preventDefault();
        toggleHelpDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHelpDrawer]);

  // Context value
  const contextValue: OnboardingContextValue = {
    // State
    welcomeDialogOpen,
    moduleIntroDialogOpen,
    currentModule,
    helpDrawerOpen,
    currentPageId,
    preferences,
    loading,

    // Actions
    dismissWelcomeDialog,
    dismissModuleIntro,
    toggleHelpDrawer,
    checkModuleVisit,
    setCurrentPageId,
    setCurrentModule: setCurrentModuleForHelp,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      <WelcomeDialog 
        open={welcomeDialogOpen} 
        onClose={dismissWelcomeDialog} 
      />
      {/* Only render HelpDrawer when we have module and page context */}
      {helpDrawerOpen && currentModule && currentPageId && (
        <HelpDrawer
          open={helpDrawerOpen}
          onClose={toggleHelpDrawer}
          moduleId={currentModule}
          pageId={currentPageId}
        />
      )}
      {/* Render HelpDrawer with dashboard defaults when no specific context */}
      {helpDrawerOpen && (!currentModule || !currentPageId) && (
        <HelpDrawer
          open={helpDrawerOpen}
          onClose={toggleHelpDrawer}
          moduleId="dashboard"
          pageId="overview"
        />
      )}
    </OnboardingContext.Provider>
  );
};
