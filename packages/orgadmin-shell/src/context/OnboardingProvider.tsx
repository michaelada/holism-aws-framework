import React, { useState, useEffect, useCallback, useContext, useRef, ReactNode } from 'react';
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
import { ModuleIntroductionDialog } from '../components/ModuleIntroductionDialog';

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
  const moduleIntroDialogOpenRef = useRef(false);
  const [currentModule, setCurrentModule] = useState<ModuleId | null>(null);
  /*
   * The module an open introduction belongs to, which is not always the module
   * the user is on: navigating on quickly moves `currentModule`, and dismissing
   * would then record the module the user landed on as visited while the one
   * they were actually introduced to comes back next login.
   */
  const [introModule, setIntroModule] = useState<ModuleId | null>(null);
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  
  // Refs for checkModuleVisit to always read current values
  // This prevents stale closures when the callback is used in useEffect deps
  const loadingRef = useRef(true);
  const welcomeDialogOpenRef = useRef(false);
  /*
   * Whether the welcome flow is over — either it was dismissed for good, or the
   * user has now closed it this session. Module introductions wait on this
   * rather than on the dialog's open flag, because the dialog is opened by an
   * effect and a navigation can reach `checkModuleVisit` first.
   */
  const welcomeSettledRef = useRef(false);
  const preferencesRef = useRef<OnboardingPreferences>(DEFAULT_PREFERENCES);
  
  // Cache state to prevent repeated API calls
  // Requirements: Performance - 21.3
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  
  // Track if welcome dialog has been shown this session
  // Prevents dialog from re-appearing after temporary dismissal
  const [welcomeShownThisSession, setWelcomeShownThisSession] = useState(false);

  // Track which modules have shown their intro dialog this session
  // Resets on full page reload (new login session) but persists across SPA navigation
  const modulesShownThisSessionRef = useRef<Set<ModuleId>>(new Set());

  // Get auth token from context
  const getToken = useContext(AuthTokenContext);

  // Sync refs during render (not in effects) so checkModuleVisit always reads current values
  loadingRef.current = loading;
  welcomeDialogOpenRef.current = welcomeDialogOpen;
  preferencesRef.current = preferences;
  // During render, not in an effect: a child's effect runs before the parent's,
  // so a page that checks its module on mount would otherwise be told the
  // welcome flow was still unresolved and have its introduction suppressed.
  if (!loading && preferences.welcomeDismissed) {
    welcomeSettledRef.current = true;
  }

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
    // Closing it settles the welcome flow whether or not it was ticked, so
    // module introductions are free to show for the rest of the session.
    welcomeSettledRef.current = true;
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
   * Only persists to modulesVisited when user checks "Don't show again"
   * Requirements: 2.3, 4.1, Performance - 21.3
   */
  const dismissModuleIntro = useCallback(async (moduleId: ModuleId, dontShowAgain: boolean) => {
    moduleIntroDialogOpenRef.current = false;
    setModuleIntroDialogOpen(false);

    // Only persist if user explicitly opted out
    if (!dontShowAgain) {
      return;
    }

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
    // Always set current module for help context
    setCurrentModule(moduleId);

    // Don't show module intro if:
    // - Still loading preferences (wait for backend data)
    // - Welcome dialog is currently open (priority - welcome must be dismissed first)
    // - Module permanently dismissed via "Don't show again"
    // - Module already shown this session (once per login session)
    // - Another module intro is already open (only one dialog at a time)
    if (
      loadingRef.current ||
      welcomeDialogOpenRef.current ||
      !welcomeSettledRef.current ||
      preferencesRef.current.modulesVisited.includes(moduleId) ||
      modulesShownThisSessionRef.current.has(moduleId) ||
      moduleIntroDialogOpenRef.current
    ) {
      return;
    }

    // Mark as shown this session so it won't show again until next login
    modulesShownThisSessionRef.current.add(moduleId);

    // Show module introduction, remembering which module it is for
    setIntroModule(moduleId);
    moduleIntroDialogOpenRef.current = true;
    setModuleIntroDialogOpen(true);
  }, []);

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
        /*
         * Don't trigger if user is typing in an input field. The target is not
         * always an element — a keydown with nothing focused arrives with the
         * document or the window as its target, and calling `closest` on those
         * throws, which would kill the shortcut instead of just declining it.
         */
        const target = event.target instanceof Element ? (event.target as HTMLElement) : null;
        const isInputField =
          target !== null &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.closest('[contenteditable="true"]') !== null);

        if (isInputField) {
          return; // Allow normal typing in input fields
        }
        
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
    introModule,
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
      {moduleIntroDialogOpen && introModule && (
        <ModuleIntroductionDialog
          open={moduleIntroDialogOpen}
          moduleId={introModule}
          onClose={(dontShowAgain) => dismissModuleIntro(introModule, dontShowAgain)}
        />
      )}
      {/* Only render HelpDrawer when we have module and page context */}
      {helpDrawerOpen && currentModule && currentPageId && (
        <HelpDrawer
          open={helpDrawerOpen}
          onClose={toggleHelpDrawer}
          moduleId={currentModule}
          pageId={currentPageId}
        />
      )}
      {/* Render HelpDrawer with module overview when page context is missing */}
      {helpDrawerOpen && currentModule && !currentPageId && (
        <HelpDrawer
          open={helpDrawerOpen}
          onClose={toggleHelpDrawer}
          moduleId={currentModule}
          pageId="overview"
        />
      )}
      {/* Render HelpDrawer with dashboard defaults when no module context */}
      {helpDrawerOpen && !currentModule && (
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
