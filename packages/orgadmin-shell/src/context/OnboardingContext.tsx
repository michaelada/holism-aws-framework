import { createContext, useContext } from 'react';

/**
 * Module identifiers for the onboarding system
 * Represents the distinct functional areas of the application
 */
export type ModuleId = 
  | 'dashboard' 
  | 'users' 
  | 'forms' 
  | 'events' 
  | 'memberships' 
  | 'calendar' 
  | 'payments';

/**
 * User preferences for onboarding dialogs
 * Tracks which dialogs have been dismissed
 */
export interface OnboardingPreferences {
  /** Whether the welcome dialog has been permanently dismissed */
  welcomeDismissed: boolean;
  /** List of modules whose introduction dialogs have been dismissed */
  modulesVisited: ModuleId[];
}

/**
 * Context value for the onboarding system
 * Provides state and actions for managing onboarding dialogs and help drawer
 */
export interface OnboardingContextValue {
  // State
  /** Whether the welcome dialog is currently open */
  welcomeDialogOpen: boolean;
  /** Whether a module introduction dialog is currently open */
  moduleIntroDialogOpen: boolean;
  /** The module whose introduction dialog is currently shown (if any) */
  currentModule: ModuleId | null;
  /** Whether the help drawer is currently open */
  helpDrawerOpen: boolean;
  /** Current page ID for contextual help */
  currentPageId: string | null;
  /** User's onboarding preferences */
  preferences: OnboardingPreferences;
  /** Whether preferences are being loaded from the backend */
  loading: boolean;
  
  // Actions
  /**
   * Dismiss the welcome dialog
   * @param dontShowAgain - If true, permanently dismiss the dialog
   */
  dismissWelcomeDialog: (dontShowAgain: boolean) => Promise<void>;
  
  /**
   * Dismiss a module introduction dialog
   * @param moduleId - The module whose introduction is being dismissed
   */
  dismissModuleIntro: (moduleId: ModuleId) => Promise<void>;
  
  /**
   * Toggle the help drawer open/closed
   */
  toggleHelpDrawer: () => void;
  
  /**
   * Check if a module has been visited and show introduction if needed
   * Also sets the current module for help context
   * @param moduleId - The module being visited
   */
  checkModuleVisit: (moduleId: ModuleId) => void;
  
  /**
   * Set the current page ID for contextual help
   * @param pageId - The page identifier
   */
  setCurrentPageId: (pageId: string | null) => void;
  
  /**
   * Set the current module for help context (without triggering intro dialog)
   * @param moduleId - The module identifier
   */
  setCurrentModule: (moduleId: ModuleId | null) => void;
}

/**
 * Default preferences for new users
 */
export const DEFAULT_PREFERENCES: OnboardingPreferences = {
  welcomeDismissed: false,
  modulesVisited: [],
};

/**
 * React context for the onboarding system
 */
export const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

/**
 * Hook to access the onboarding context
 * @throws Error if used outside of OnboardingProvider
 * @returns The onboarding context value
 */
export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
