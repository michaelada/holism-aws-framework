/**
 * usePageHelp Hook
 * 
 * Hook that accepts pageId parameter and updates OnboardingContext
 * with current pageId for contextual help display.
 * 
 * Requirements: 8.2
 */

import { useEffect } from 'react';
import { useOnboarding } from '../context/OnboardingContext';

/**
 * Register the current page for contextual help
 * 
 * Updates the onboarding context with the current page ID,
 * which is used by the HelpDrawer to display relevant help content.
 * 
 * @param pageId - Identifier for the current page (e.g., 'list', 'create', 'edit')
 * 
 * @example
 * ```tsx
 * function UserListPage() {
 *   usePageHelp('list');
 *   // ... rest of component
 * }
 * ```
 */
export function usePageHelp(pageId: string): void {
  const { setCurrentPageId } = useOnboarding();
  
  useEffect(() => {
    // Update context with current page ID
    setCurrentPageId(pageId);
    
    // Cleanup: clear page ID when component unmounts
    return () => {
      setCurrentPageId(null);
    };
  }, [pageId, setCurrentPageId]);
}
