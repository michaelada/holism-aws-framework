/**
 * Property-Based Tests for OnboardingProvider - Universal Dialog Dismissibility
 * 
 * Feature: onboarding-and-help-system
 * Property 6: Universal Dialog Dismissibility
 * 
 * For any dialog (welcome or module intro), the user should be able to dismiss it
 * immediately without completing any required actions.
 * 
 * **Validates: Requirements 6.1**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { useOnboarding } from '../../context/OnboardingContext';
import { ModuleId } from '../../context/OnboardingContext';
import { ModuleIntroductionDialog } from '../../components/ModuleIntroductionDialog';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock AuthTokenContext
const mockGetToken = vi.fn(() => 'mock-token-123');
vi.mock('@aws-web-framework/orgadmin-core', () => ({
  AuthTokenContext: React.createContext(() => 'mock-token-123'),
}));

// Mock useTranslation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'welcome.title': 'Welcome to OrgAdmin',
        'welcome.content': 'Welcome content',
        'welcome.dontShowAgain': "Don't show this again",
        'translation:common.actions.close': 'Close',
        'actions.gotIt': 'Got it',
      };
      
      // Handle module-specific translations
      if (key.startsWith('modules.')) {
        const parts = key.split('.');
        const moduleId = parts[1];
        const field = parts[2];
        if (field === 'title') {
          return `${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Module`;
        }
        if (field === 'content') {
          return `Content for ${moduleId} module`;
        }
      }
      
      return translations[key] || key;
    },
  }),
}));

// Test component to access onboarding context
interface TestComponentProps {
  onMount?: (context: ReturnType<typeof useOnboarding>) => void;
}

const TestComponent: React.FC<TestComponentProps> = ({ onMount }) => {
  const context = useOnboarding();
  
  React.useEffect(() => {
    if (!context.loading && onMount) {
      onMount(context);
    }
  }, [context.loading]);
  
  return (
    <div data-testid="test-component">
      <div data-testid="loading">{context.loading ? 'loading' : 'loaded'}</div>
      <div data-testid="welcome-open">{context.welcomeDialogOpen ? 'open' : 'closed'}</div>
      <div data-testid="module-open">{context.moduleIntroDialogOpen ? 'open' : 'closed'}</div>
      {context.moduleIntroDialogOpen && context.currentModule && (
        <ModuleIntroductionDialog
          open={context.moduleIntroDialogOpen}
          moduleId={context.currentModule}
          onClose={() => context.dismissModuleIntro(context.currentModule!)}
        />
      )}
    </div>
  );
};

describe('Property 6: Universal Dialog Dismissibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
  });

  /**
   * Arbitrary generator for module IDs
   */
  const moduleIdArbitrary = fc.constantFrom<ModuleId>(
    'dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'
  );

  /**
   * Property: Welcome dialog can be dismissed immediately without any required actions
   * 
   * This property verifies that for any state of the "don't show again" checkbox,
   * the welcome dialog can be closed immediately by clicking the close button.
   */
  it('should allow welcome dialog to be dismissed immediately without required actions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // dontShowAgain checkbox state
        async (dontShowAgainChecked) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome NOT dismissed
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: false,
                modulesVisited: [],
              },
            },
          });

          mockedAxios.put.mockResolvedValueOnce({
            data: { success: true },
          });

          const user = userEvent.setup();

          // Act: Render provider
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent />
            </OnboardingProvider>
          );

          // Wait for welcome dialog to open
          await waitFor(() => {
            expect(screen.getByTestId('welcome-open').textContent).toBe('open');
          }, { timeout: 2000 });

          // Verify dialog is visible
          const dialogTitle = await screen.findByText('Welcome to OrgAdmin');
          expect(dialogTitle).toBeInTheDocument();

          // Optionally check the "don't show again" checkbox based on property input
          if (dontShowAgainChecked) {
            const checkbox = screen.getByRole('checkbox', { name: /don't show this again/i });
            await user.click(checkbox);
          }

          // Property: User can dismiss immediately by clicking close button
          const closeButton = screen.getByRole('button', { name: /close/i });
          await user.click(closeButton);

          // Assert: Dialog should close immediately
          await waitFor(() => {
            expect(screen.getByTestId('welcome-open').textContent).toBe('closed');
          }, { timeout: 1000 });

          // Verify no errors occurred during dismissal
          expect(screen.getByTestId('test-component')).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 20000); // 20 second timeout

  /**
   * Property: Module introduction dialog can be dismissed immediately without required actions
   * 
   * This property verifies that for any module, the module introduction dialog
   * can be closed immediately by clicking the "Got it" button.
   */
  it('should allow module introduction dialog to be dismissed immediately without required actions', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (moduleId) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome dismissed and module not visited
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true,
                modulesVisited: [],
              },
            },
          });

          mockedAxios.put.mockResolvedValueOnce({
            data: { success: true },
          });

          const user = userEvent.setup();
          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render provider and trigger module visit
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                  // Trigger module visit after loading
                  if (!ctx.loading) {
                    ctx.checkModuleVisit(moduleId);
                  }
                }}
              />
            </OnboardingProvider>
          );

          // Wait for module intro dialog to open
          await waitFor(() => {
            expect(screen.getByTestId('module-open').textContent).toBe('open');
          }, { timeout: 2000 });

          // Verify dialog is visible
          const expectedTitle = `${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Module`;
          const dialogTitle = await screen.findByText(expectedTitle);
          expect(dialogTitle).toBeInTheDocument();

          // Property: User can dismiss immediately by clicking "Got it" button
          const gotItButton = screen.getByRole('button', { name: /got it/i });
          await user.click(gotItButton);

          // Assert: Dialog should close immediately
          await waitFor(() => {
            expect(screen.getByTestId('module-open').textContent).toBe('closed');
          }, { timeout: 1000 });

          // Verify no errors occurred during dismissal
          expect(screen.getByTestId('test-component')).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 20000); // 20 second timeout

  /**
   * Property: Dialogs can be dismissed via backdrop click (onClose handler)
   * 
   * This property verifies that dialogs respond to the MUI Dialog's onClose
   * event, which is triggered by clicking outside the dialog or pressing Escape.
   */
  it('should allow dialogs to be dismissed via onClose handler (backdrop click)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<'welcome' | 'module'>('welcome', 'module'),
        moduleIdArbitrary,
        async (dialogType, moduleId) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences based on dialog type
          const preferences = dialogType === 'welcome'
            ? { welcomeDismissed: false, modulesVisited: [] }
            : { welcomeDismissed: true, modulesVisited: [] };

          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: preferences,
            },
          });

          mockedAxios.put.mockResolvedValueOnce({
            data: { success: true },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render provider
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                  // Trigger module visit if testing module dialog
                  if (dialogType === 'module' && !ctx.loading) {
                    ctx.checkModuleVisit(moduleId);
                  }
                }}
              />
            </OnboardingProvider>
          );

          // Wait for appropriate dialog to open
          const testId = dialogType === 'welcome' ? 'welcome-open' : 'module-open';
          await waitFor(() => {
            expect(screen.getByTestId(testId).textContent).toBe('open');
          }, { timeout: 2000 });

          // Property: Dialog can be dismissed programmatically via onClose
          // (simulating backdrop click or Escape key)
          if (dialogType === 'welcome') {
            await contextRef?.dismissWelcomeDialog(false);
          } else {
            await contextRef?.dismissModuleIntro(moduleId);
          }

          // Assert: Dialog should close immediately
          await waitFor(() => {
            expect(screen.getByTestId(testId).textContent).toBe('closed');
          }, { timeout: 1000 });

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 20000); // 20 second timeout

  /**
   * Property: Dismissing dialogs never causes errors or blocks the UI
   * 
   * This property verifies that dismissing any dialog at any time does not
   * cause errors, exceptions, or leave the UI in a broken state.
   */
  it('should never cause errors when dismissing dialogs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // welcomeDismissed
        fc.array(moduleIdArbitrary, { maxLength: 7 }), // modulesVisited
        moduleIdArbitrary, // module to visit
        fc.boolean(), // dontShowAgain for welcome
        async (welcomeDismissed, modulesVisited, targetModule, dontShowAgain) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed,
                modulesVisited: [...new Set(modulesVisited)],
              },
            },
          });

          mockedAxios.put.mockResolvedValue({
            data: { success: true },
          });

          const user = userEvent.setup();
          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render provider
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                }}
              />
            </OnboardingProvider>
          );

          // Wait for loading to complete
          await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('loaded');
          }, { timeout: 2000 });

          // Try to trigger module visit
          if (contextRef && !contextRef.loading) {
            contextRef.checkModuleVisit(targetModule);
          }

          // Give time for any dialogs to open
          await new Promise(resolve => setTimeout(resolve, 200));

          // Property: Attempt to dismiss any open dialogs - should never throw errors
          try {
            // Try to dismiss welcome dialog
            if (contextRef?.welcomeDialogOpen) {
              const closeButton = screen.queryByRole('button', { name: /close/i });
              if (closeButton) {
                await user.click(closeButton);
              } else {
                // Fallback to programmatic dismissal
                await contextRef.dismissWelcomeDialog(dontShowAgain);
              }
            }

            // Try to dismiss module intro dialog
            if (contextRef?.moduleIntroDialogOpen && contextRef.currentModule) {
              const gotItButton = screen.queryByRole('button', { name: /got it/i });
              if (gotItButton) {
                await user.click(gotItButton);
              } else {
                // Fallback to programmatic dismissal
                await contextRef.dismissModuleIntro(contextRef.currentModule);
              }
            }

            // Assert: No errors should have been thrown
            expect(screen.getByTestId('test-component')).toBeInTheDocument();
            
            // UI should still be functional
            expect(screen.getByTestId('loading').textContent).toBe('loaded');
          } catch (error) {
            // Property violation: Dismissing a dialog should never throw an error
            throw new Error(`Dialog dismissal caused an error: ${error}`);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout

  /**
   * Property: Dialogs can be dismissed multiple times without side effects
   * 
   * This property verifies that calling dismiss functions multiple times
   * (e.g., rapid clicks) doesn't cause errors or unexpected behavior.
   */
  it('should handle multiple rapid dismissal attempts gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // number of rapid dismiss attempts
        async (dismissAttempts) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome NOT dismissed
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: false,
                modulesVisited: [],
              },
            },
          });

          mockedAxios.put.mockResolvedValue({
            data: { success: true },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render provider
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                }}
              />
            </OnboardingProvider>
          );

          // Wait for welcome dialog to open
          await waitFor(() => {
            expect(screen.getByTestId('welcome-open').textContent).toBe('open');
          }, { timeout: 2000 });

          // Property: Attempt to dismiss multiple times rapidly
          const dismissPromises: Promise<void>[] = [];
          for (let i = 0; i < dismissAttempts; i++) {
            if (contextRef) {
              dismissPromises.push(contextRef.dismissWelcomeDialog(false));
            }
          }

          // Wait for all dismiss attempts to complete
          await Promise.all(dismissPromises);

          // Assert: Dialog should be closed and no errors should occur
          await waitFor(() => {
            expect(screen.getByTestId('welcome-open').textContent).toBe('closed');
          }, { timeout: 1000 });

          // UI should still be functional
          expect(screen.getByTestId('test-component')).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 20000); // 20 second timeout
});
