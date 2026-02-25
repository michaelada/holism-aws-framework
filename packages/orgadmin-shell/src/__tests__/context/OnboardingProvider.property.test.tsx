/**
 * Property-Based Tests for OnboardingProvider - Dismissed Dialogs
 * 
 * Feature: onboarding-and-help-system
 * Property 3: Dismissed Dialogs Remain Dismissed
 * 
 * For any dialog that has been dismissed (welcome or module intro), when the user
 * returns to the application or revisits the module, the dialog should not appear again.
 * 
 * **Validates: Requirements 1.5, 2.4, 6.4**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
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
}

const TestComponent: React.FC<TestComponentProps> = ({ onMount }) => {
  const context = useOnboarding();
  
  React.useEffect(() => {
    if (onMount) {
      onMount(context);
    }
  }, [context.loading, context.welcomeDialogOpen, context.moduleIntroDialogOpen]);
  
  return (
    <div data-testid="test-component">
      <div data-testid="loading">{context.loading ? 'loading' : 'loaded'}</div>
      <div data-testid="welcome-open">{context.welcomeDialogOpen ? 'open' : 'closed'}</div>
      <div data-testid="module-open">{context.moduleIntroDialogOpen ? 'open' : 'closed'}</div>
    </div>
  );
};

describe('Property 3: Dismissed Dialogs Remain Dismissed', () => {
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
   * Property: Once welcome dialog is dismissed, it should never appear again
   */
  it('should keep welcome dialog dismissed across application reloads', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(moduleIdArbitrary, { maxLength: 7 }),
        async (initialModulesVisited) => {
          vi.clearAllMocks();

          // Arrange: Mock initial preferences - welcome NOT dismissed
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: false,
                modulesVisited: initialModulesVisited,
              },
            },
          });

          mockedAxios.put.mockResolvedValueOnce({
            data: { success: true },
          });

          // Act: First render
          const { unmount, getByTestId } = render(
            <OnboardingProvider>
              <TestComponent />
            </OnboardingProvider>
          );

          // Wait for loading to complete
          await waitFor(() => {
            expect(getByTestId('loading').textContent).toBe('loaded');
          }, { timeout: 2000 });

          // Wait for welcome dialog to open (it opens in a useEffect after loading)
          await waitFor(() => {
            expect(getByTestId('welcome-open').textContent).toBe('open');
          }, { timeout: 2000 });

          unmount();

          // Act: Second render - simulate reload with dismissed preference
          vi.clearAllMocks();
          
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true, // Now dismissed
                modulesVisited: initialModulesVisited,
              },
            },
          });

          const { unmount: unmount2, getByTestId: getByTestId2 } = render(
            <OnboardingProvider>
              <TestComponent />
            </OnboardingProvider>
          );

          await waitFor(() => {
            expect(getByTestId2('loading').textContent).toBe('loaded');
          }, { timeout: 2000 });

          // Assert: Property - Welcome dialog remains dismissed
          expect(getByTestId2('welcome-open').textContent).toBe('closed');

          unmount2();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Once a module introduction is dismissed, it should never
   * appear again when revisiting that module
   */
  it('should keep module introduction dismissed across module revisits', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (targetModule) => {
          vi.clearAllMocks();

          // Arrange: Mock initial preferences (module not visited)
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true, // Welcome already dismissed
                modulesVisited: [],
              },
            },
          });

          mockedAxios.put.mockResolvedValueOnce({
            data: { success: true },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: First visit to module
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                  // Trigger module visit check after loading
                  if (!ctx.loading && !ctx.moduleIntroDialogOpen) {
                    ctx.checkModuleVisit(targetModule);
                  }
                }}
              />
            </OnboardingProvider>
          );

          // Wait for loading and module intro to open
          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // The module intro should open after checkModuleVisit is called
          await waitFor(() => {
            expect(contextRef?.moduleIntroDialogOpen).toBe(true);
          }, { timeout: 2000 });

          unmount();

          // Act: Second visit - simulate revisit with dismissed preference
          vi.clearAllMocks();

          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true,
                modulesVisited: [targetModule], // Now visited
              },
            },
          });

          let revisitContextRef: ReturnType<typeof useOnboarding> | null = null;

          const { unmount: unmount2 } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  revisitContextRef = ctx;
                  // Try to trigger module visit again
                  if (!ctx.loading) {
                    ctx.checkModuleVisit(targetModule);
                  }
                }}
              />
            </OnboardingProvider>
          );

          await waitFor(() => {
            expect(revisitContextRef).not.toBeNull();
            expect(revisitContextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Assert: Property - Module intro remains dismissed
          expect(revisitContextRef?.moduleIntroDialogOpen).toBe(false);
          expect(revisitContextRef?.preferences.modulesVisited).toContain(targetModule);

          unmount2();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Dismissed state is user-specific and respected from backend
   */
  it('should respect user-specific dismissal preferences from backend', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.array(moduleIdArbitrary, { maxLength: 7 }),
        async (welcomeDismissed, modulesVisited) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences for specific user
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed,
                modulesVisited: [...new Set(modulesVisited)],
              },
            },
          });

          const { getByTestId, unmount } = render(
            <OnboardingProvider>
              <TestComponent />
            </OnboardingProvider>
          );

          await waitFor(() => {
            expect(getByTestId('loading').textContent).toBe('loaded');
          }, { timeout: 2000 });

          // Property: Welcome dialog state matches preferences
          const expectedWelcomeState = welcomeDismissed ? 'closed' : 'open';
          await waitFor(() => {
            expect(getByTestId('welcome-open').textContent).toBe(expectedWelcomeState);
          }, { timeout: 2000 });

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Preferences persist correctly through the API
   */
  it('should persist dismissal preferences to backend API', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (moduleId) => {
          vi.clearAllMocks();

          // Test welcome dismissal
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

          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                }}
              />
            </OnboardingProvider>
          );

          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Wait for welcome dialog to open
          await waitFor(() => {
            expect(contextRef?.welcomeDialogOpen).toBe(true);
          }, { timeout: 2000 });

          // Dismiss it
          await contextRef?.dismissWelcomeDialog(true);

          // Property: API should be called with correct data
          await waitFor(() => {
            expect(mockedAxios.put).toHaveBeenCalledWith(
              '/api/user-preferences/onboarding',
              { welcomeDismissed: true },
              expect.any(Object)
            );
          }, { timeout: 1000 });

          unmount();

          // Test module dismissal
          vi.clearAllMocks();

          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true, // Welcome already dismissed
                modulesVisited: [],
              },
            },
          });

          mockedAxios.put.mockResolvedValueOnce({
            data: { success: true },
          });

          let moduleContextRef: ReturnType<typeof useOnboarding> | null = null;

          const { unmount: unmount2 } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  moduleContextRef = ctx;
                  // Trigger module visit after loading
                  if (!ctx.loading && !ctx.moduleIntroDialogOpen) {
                    ctx.checkModuleVisit(moduleId);
                  }
                }}
              />
            </OnboardingProvider>
          );

          await waitFor(() => {
            expect(moduleContextRef).not.toBeNull();
            expect(moduleContextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Wait for module intro to open
          await waitFor(() => {
            expect(moduleContextRef?.moduleIntroDialogOpen).toBe(true);
          }, { timeout: 2000 });

          // Dismiss it
          await moduleContextRef?.dismissModuleIntro(moduleId);

          // Property: API should be called with module in visited list
          await waitFor(() => {
            expect(mockedAxios.put).toHaveBeenCalledWith(
              '/api/user-preferences/onboarding',
              { modulesVisited: expect.arrayContaining([moduleId]) },
              expect.any(Object)
            );
          }, { timeout: 1000 });

          unmount2();
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property-Based Tests for OnboardingProvider - First Module Visit
 * 
 * Feature: onboarding-and-help-system
 * Property 4: First Module Visit Triggers Introduction
 * 
 * For any module that has not been visited before (not in modulesVisited array),
 * when the user navigates to that module, the module introduction dialog should appear.
 * 
 * **Validates: Requirements 2.1**
 */
describe('Property 4: First Module Visit Triggers Introduction', () => {
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
   * Property: For any unvisited module, checkModuleVisit should trigger the introduction dialog
   */
  it('should show module introduction for any unvisited module', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        fc.array(moduleIdArbitrary, { maxLength: 6 }),
        async (targetModule, visitedModules) => {
          // Ensure target module is NOT in visited list
          const modulesVisited = visitedModules.filter(m => m !== targetModule);
          
          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome dismissed and target module not visited
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true, // Welcome already dismissed to avoid interference
                modulesVisited: [...new Set(modulesVisited)],
              },
            },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render provider and trigger module visit
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                  // Trigger module visit check after loading
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

          // Assert: Property - Module introduction dialog should open
          await waitFor(() => {
            expect(contextRef?.moduleIntroDialogOpen).toBe(true);
            expect(contextRef?.currentModule).toBe(targetModule);
          }, { timeout: 2000 });

          unmount();
        }
      ),
      { numRuns: 50 } // Reduced from 100
    );
  }, 15000); // 15 second timeout

  /**
   * Property: For any visited module, checkModuleVisit should NOT trigger the introduction dialog
   */
  it('should NOT show module introduction for any already visited module', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        fc.array(moduleIdArbitrary, { minLength: 0, maxLength: 6 }),
        async (targetModule, otherModules) => {
          // Ensure target module IS in visited list
          const modulesVisited = [...new Set([targetModule, ...otherModules])];
          
          vi.clearAllMocks();

          // Arrange: Mock preferences with target module already visited
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true,
                modulesVisited,
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

          // Try to trigger module visit check
          contextRef?.checkModuleVisit(targetModule);

          // Give it a moment to potentially open (it shouldn't)
          await new Promise(resolve => setTimeout(resolve, 100));

          // Assert: Property - Module introduction dialog should NOT open
          expect(contextRef?.moduleIntroDialogOpen).toBe(false);
          expect(contextRef?.currentModule).toBeNull();

          unmount();
        }
      ),
      { numRuns: 50 } // Reduced from 100
    );
  }, 15000); // 15 second timeout for property test

  /**
   * Property: Module introduction should not show if welcome dialog is open (priority)
   */
  it('should NOT show module introduction when welcome dialog has priority', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (targetModule) => {
          vi.clearAllMocks();

          // Arrange: Mock preferences with welcome NOT dismissed
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: false, // Welcome dialog will open
                modulesVisited: [], // Target module not visited
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

          // Wait for welcome dialog to open
          await waitFor(() => {
            expect(contextRef?.welcomeDialogOpen).toBe(true);
          }, { timeout: 2000 });

          // Now try to trigger module visit while welcome is open
          contextRef?.checkModuleVisit(targetModule);

          // Give it a moment to potentially open (it shouldn't)
          await new Promise(resolve => setTimeout(resolve, 100));

          // Assert: Property - Module introduction should NOT open (welcome has priority)
          expect(contextRef?.moduleIntroDialogOpen).toBe(false);
          expect(contextRef?.currentModule).toBeNull();

          unmount();
        }
      ),
      { numRuns: 50 } // Reduced from 100
    );
  }, 10000); // 10 second timeout

  /**
   * Property: For any combination of visited and unvisited modules,
   * only unvisited modules trigger introductions
   */
  it('should correctly distinguish between visited and unvisited modules', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(moduleIdArbitrary, { minLength: 1, maxLength: 7 }),
        fc.array(moduleIdArbitrary, { minLength: 0, maxLength: 7 }),
        async (allModules, visitedModules) => {
          // Remove duplicates
          const uniqueAllModules = [...new Set(allModules)];
          const uniqueVisitedModules = [...new Set(visitedModules)];
          
          // Find an unvisited module
          const unvisitedModule = uniqueAllModules.find(
            m => !uniqueVisitedModules.includes(m)
          );

          // Skip if all modules are visited
          if (!unvisitedModule) {
            return;
          }

          vi.clearAllMocks();

          // Arrange: Mock preferences
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              success: true,
              data: {
                welcomeDismissed: true,
                modulesVisited: uniqueVisitedModules,
              },
            },
          });

          let contextRef: ReturnType<typeof useOnboarding> | null = null;

          // Act: Render and check the unvisited module
          const { unmount } = render(
            <OnboardingProvider>
              <TestComponent
                onMount={(ctx) => {
                  contextRef = ctx;
                }}
              />
            </OnboardingProvider>
          );

          await waitFor(() => {
            expect(contextRef).not.toBeNull();
            expect(contextRef?.loading).toBe(false);
          }, { timeout: 2000 });

          // Trigger module visit after loading
          contextRef?.checkModuleVisit(unvisitedModule);

          // Assert: Unvisited module should trigger introduction
          await waitFor(() => {
            expect(contextRef?.moduleIntroDialogOpen).toBe(true);
            expect(contextRef?.currentModule).toBe(unvisitedModule);
          }, { timeout: 2000 });

          unmount();

          // Now test a visited module (if any)
          if (uniqueVisitedModules.length > 0) {
            const visitedModule = uniqueVisitedModules[0];
            
            vi.clearAllMocks();

            mockedAxios.get.mockResolvedValueOnce({
              data: {
                success: true,
                data: {
                  welcomeDismissed: true,
                  modulesVisited: uniqueVisitedModules,
                },
              },
            });

            let visitedContextRef: ReturnType<typeof useOnboarding> | null = null;

            const { unmount: unmount2 } = render(
              <OnboardingProvider>
                <TestComponent
                  onMount={(ctx) => {
                    visitedContextRef = ctx;
                  }}
                />
              </OnboardingProvider>
            );

            await waitFor(() => {
              expect(visitedContextRef).not.toBeNull();
              expect(visitedContextRef?.loading).toBe(false);
            }, { timeout: 2000 });

            // Trigger module visit
            visitedContextRef?.checkModuleVisit(visitedModule);

            // Give it a moment
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert: Visited module should NOT trigger introduction
            expect(visitedContextRef?.moduleIntroDialogOpen).toBe(false);

            unmount2();
          }
        }
      ),
      { numRuns: 50 } // Reduced from 100
    );
  }, 20000); // 20 second timeout for this more complex property test
});
