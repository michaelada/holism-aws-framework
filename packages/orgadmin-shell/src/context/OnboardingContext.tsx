import { createContext, useContext } from 'react';

/**
 * Module identifiers for the onboarding system.
 * Represents the distinct functional areas of the application.
 *
 * A value, not only a type, because the backend keeps its own copy of this list
 * to validate `modulesVisited` against, and a type cannot be compared with it at
 * runtime. A module missing from the backend's copy makes "Don't show this
 * again" fail silently — the save is refused with a 400, the optimistic update
 * is reverted, and the dialog returns on the user's next visit. A test in
 * `__tests__/context/OnboardingProvider.module-parity.test.ts` holds the two
 * lists together; see `docs/ONBOARDING_DISMISSAL_IGNORED.md`.
 */
export const MODULE_IDS = [
  'dashboard',
  'users',
  'forms',
  'events',
  'memberships',
  'registrations',
  'calendar',
  'payments',
  'merchandise',
  'ticketing',
  'settings',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

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
  /** The module the user is on, used as the context for the help drawer */
  currentModule: ModuleId | null;
  /**
   * The module the open introduction dialog belongs to, which is not always
   * `currentModule` — navigating on while an introduction is open moves the
   * help context but leaves the dialog, and its dismissal, with the module it
   * was opened for.
   */
  introModule: ModuleId | null;
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
   * @param dontShowAgain - If true, permanently dismiss the dialog for this module
   */
  dismissModuleIntro: (moduleId: ModuleId, dontShowAgain: boolean) => Promise<void>;
  
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
