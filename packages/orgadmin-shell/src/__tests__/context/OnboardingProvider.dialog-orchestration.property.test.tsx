/**
 * Property-Based Tests for OnboardingProvider - Dialog Orchestration
 * 
 * Feature: onboarding-and-help-system
 * Property 7: Single Dialog Display
 * 
 * For any combination of simultaneous onboarding events (e.g., first login + first module visit),
 * the system should display at most one dialog at a time, with welcome dialog taking precedence
 * over module intros.
 * 
 * **Validates: Requirements 6.3**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { useOnboarding } from '../../context/OnboardingContext';
import { ModuleId } from '../../context/OnboardingContext';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock AuthTokenContext
const mockGetToken = vi.fn(() => 'mock-token-123');
vi.mock('@aws-web-framework/orgadmin-core', () => ({
  AuthTokenContext: React.createContext(() => 'mock-token-123'),
}));

// Test component to access onboarding context
interface TestComponentProps {
  onMount?: (context: ReturnType<typeof useOnboarding>) => void;
  onUpdate?: (context: ReturnType<typeof useOnboarding>) => void;
}

const TestComponent: React.FC<TestComponentProps> = ({ onMount, onUpdate }) => {
  const context = useOnboarding();
  const mountedRef = React.useRef(false);
  
  React.useEffect(() => {
    if (!mountedRef.current && !context.loading) {
      mountedRef.current = true;
      if (onMount) {
        onMount(context);
      }
    }
  }, [context.loading]);

  React.useEffect(() => {
    if (mountedRef.current && onUpdate) {
      onUpdate(context);
    }
  }, [context.welcomeDialogOpen, context.moduleIntroDialogOpen, context.helpDrawerOpen]);
  
  return (
    <div data-testid="test-component">
      <div data-testid="loading">{context.loading ? 'loading' : 'loaded'}</div>
      <div data-testid="welcome-open">{context.welcomeDialogOpen ? 'open' : 'closed'}</div>
      <div data-testid="module-open">{context.moduleIntroDialogOpen ? 'open' : 'closed'}</div>
      <div data-testid="current-module">{context.currentModule || 'none'}</div>
    </div>
  );
};

describe('Property 7: Single Dialog Display', () => {
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
   * Property: At most one dialog should be open at any time
   * 
   * This property verifies that the system never displays multiple dialogs simultaneously.
   * It tests various combinations of welcome dialog and module intro states.
   */
  it('should display at most one dialog at any time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // welcomeDismissed
        fc.array(moduleIdArbitrary, { maxLength: 7 }), // modulesVisited
        moduleIdArbitrary, // targetModule to visit
        async (welcomeDismissed, modulesVisited, targetModule) => {
          // Ensure target module is not in visited list for this test
          const uniqueModulesVisited = [...new Set(modulesVisited.filter(m => m !== targetModule))];
          
          vi.clearAllMocks();

          // Arrange: Mock preferences
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed,
                modulesVisited: uniqueModulesVisited,
              },
            },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;
          const dialogStates: Array<{ welcome: boolean; module: boolean }> = [];

          // Act: Render provider and track dialog states
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                  // Try to trigger module visit immediately after loading
                  if (!ctx.loading) {
                    ctx.checkModuleVisit(targetModule);
                  }
                }}
                onUpdate={(ctx) => {
                  // Track all dialog state changes
                  dialogStates.push({
                    welcome: ctx.welcomeDialogOpen,
                    module: ctx.moduleIntroDialogOpen,
                  });
                }}
              />
            </OnboardingProvider>
          );

          // Wait for loading to complete
          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Try to trigger module visit after loading (in case it wasn't triggered in onMount)
          if (contextRef && !contextRef.moduleIntroDialogOpen) {
            act(() => {
              contextRef?.checkModuleVisit(targetModule);
            });
          }

          // Give time for any state changes to settle
          await new Promise(resolve => setTimeout(resolve, 200));

          // Assert: Property - At most one dialog open at any time
          // Check all recorded states
          for (const state of dialogStates) {
            const bothOpen = state.welcome && state.module;
            expect(bothOpen).toBe(false);
          }

          // Also check final state
          if (contextRef) {
            const bothOpen = contextRef.welcomeDialogOpen && contextRef.moduleIntroDialogOpen;
            expect(bothOpen).toBe(false);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout

  /**
   * Property: Welcome dialog takes precedence over module introductions
   * 
   * When both welcome dialog and module intro could be shown, welcome dialog
   * should be displayed first, and module intro should wait.
   */
  it('should give welcome dialog precedence over module introductions', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (targetModule) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences where welcome is NOT dismissed and module is NOT visited
          // This creates a scenario where both dialogs could potentially show
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: false, // Welcome should show
                modulesVisited: [], // Module intro could show
              },
            },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render provider and try to trigger module visit
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                  // Try to trigger module visit while welcome might be showing
                  if (!ctx.loading) {
                    ctx.checkModuleVisit(targetModule);
                  }
                }}
              />
            </OnboardingProvider>
          );

          // Wait for loading to complete
          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Wait for welcome dialog to open
          await waitFor(() => {
            expect(contextRef?.welcomeDialogOpen).toBe(true);
          }, { timeout: 2000 });

          // Try to trigger module visit while welcome is open
          act(() => {
            contextRef?.checkModuleVisit(targetModule);
          });

          // Give it a moment to potentially open (it shouldn't)
          await new Promise(resolve => setTimeout(resolve, 100));

          // Assert: Property - Welcome dialog is open, module intro is NOT
          expect(contextRef?.welcomeDialogOpen).toBe(true);
          expect(contextRef?.moduleIntroDialogOpen).toBe(false);
          expect(contextRef?.currentModule).toBeNull();

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 15000); // 15 second timeout

  /**
   * Property: Module intro can show after welcome dialog is dismissed
   * 
   * Once the welcome dialog is dismissed, module introductions should be able to show
   * for unvisited modules.
   */
  it('should allow module intro to show after welcome dialog is dismissed', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (targetModule) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome NOT dismissed initially
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
            expect(contextRef).not.toBeNull();
            expect(contextRef?.welcomeDialogOpen).toBe(true);
          }, { timeout: 2000 });

          // Dismiss welcome dialog
          await act(async () => {
            await contextRef?.dismissWelcomeDialog(true);
          });

          // Wait for welcome dialog to close
          await waitFor(() => {
            expect(contextRef?.welcomeDialogOpen).toBe(false);
          }, { timeout: 1000 });

          // Now trigger module visit
          act(() => {
            contextRef?.checkModuleVisit(targetModule);
          });

          // Assert: Property - Module intro should now be able to open
          await waitFor(() => {
            expect(contextRef?.moduleIntroDialogOpen).toBe(true);
            expect(contextRef?.currentModule).toBe(targetModule);
          }, { timeout: 2000 });

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 20000); // 20 second timeout

  /**
   * Property: Only one module intro can be open at a time
   * 
   * When multiple module visits are triggered, only one module intro dialog
   * should be displayed at a time.
   */
  it('should display only one module intro at a time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(moduleIdArbitrary, { minLength: 2, maxLength: 7 }),
        async (modulesToVisit) => {
          // Ensure we have at least 2 unique modules
          const uniqueModules = [...new Set(modulesToVisit)];
          if (uniqueModules.length < 2) {
            return; // Skip this test case
          }

          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome dismissed and no modules visited
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true,
                modulesVisited: [],
              },
            },
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

          // Wait for loading to complete
          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Try to trigger multiple module visits rapidly
          act(() => {
            for (const moduleId of uniqueModules) {
              contextRef?.checkModuleVisit(moduleId);
            }
          });

          // Give time for state to settle
          await new Promise(resolve => setTimeout(resolve, 200));

          // Assert: Property - Only one module intro should be open
          if (contextRef?.moduleIntroDialogOpen) {
            expect(contextRef.currentModule).not.toBeNull();
            // The current module should be one of the modules we tried to visit
            expect(uniqueModules).toContain(contextRef.currentModule!);
          }

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  }, 15000); // 15 second timeout

  /**
   * Property: Dialog orchestration respects all priority rules
   * 
   * This comprehensive property test verifies that the dialog orchestration
   * correctly handles all combinations of states and respects priority rules.
   */
  it('should respect all dialog priority and orchestration rules', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // welcomeDismissed
        fc.array(moduleIdArbitrary, { maxLength: 7 }), // modulesVisited
        fc.array(moduleIdArbitrary, { minLength: 1, maxLength: 3 }), // modules to visit
        async (welcomeDismissed, modulesVisited, modulesToVisit) => {
          const uniqueModulesVisited = [...new Set(modulesVisited)];
          const uniqueModulesToVisit = [...new Set(modulesToVisit)];
          
          vi.clearAllMocks();

          // Arrange: Mock preferences
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed,
                modulesVisited: uniqueModulesVisited,
              },
            },
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

          // Wait for loading to complete
          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Wait for any initial dialogs to open
          await new Promise(resolve => setTimeout(resolve, 200));

          // Try to trigger module visits
          act(() => {
            for (const moduleId of uniqueModulesToVisit) {
              contextRef?.checkModuleVisit(moduleId);
            }
          });

          // Give time for state to settle
          await new Promise(resolve => setTimeout(resolve, 200));

          // Assert: Property - Verify orchestration rules
          if (contextRef) {
            // Rule 1: At most one dialog open at a time
            const bothOpen = contextRef.welcomeDialogOpen && contextRef.moduleIntroDialogOpen;
            expect(bothOpen).toBe(false);

            // Rule 2: If welcome is not dismissed, it should take precedence
            if (!welcomeDismissed) {
              if (contextRef.welcomeDialogOpen) {
                expect(contextRef.moduleIntroDialogOpen).toBe(false);
              }
            }

            // Rule 3: Module intros only show for unvisited modules
            if (contextRef.moduleIntroDialogOpen && contextRef.currentModule) {
              expect(uniqueModulesVisited).not.toContain(contextRef.currentModule);
            }

            // Rule 4: If a module intro is open, it should be one we tried to visit
            if (contextRef.moduleIntroDialogOpen && contextRef.currentModule) {
              expect(uniqueModulesToVisit).toContain(contextRef.currentModule);
            }
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout
});
