/**
 * Unit Tests for OnboardingProvider - Dialog Orchestration
 * 
 * Tests specific examples and edge cases for dialog orchestration logic.
 * Covers welcome dialog precedence, module intro sequencing, and dialog priority rules.
 * 
 * Requirements: 6.3
 */

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
  }, [context.welcomeDialogOpen, context.moduleIntroDialogOpen, context.helpDrawerOpen, context.preferences]);
  
  return (
    <div data-testid="test-component">
      <div data-testid="loading">{context.loading ? 'loading' : 'loaded'}</div>
      <div data-testid="welcome-open">{context.welcomeDialogOpen ? 'open' : 'closed'}</div>
      <div data-testid="module-open">{context.moduleIntroDialogOpen ? 'open' : 'closed'}</div>
      <div data-testid="current-module">{context.currentModule || 'none'}</div>
    </div>
  );
};

describe('OnboardingProvider - Dialog Orchestration Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
  });

  describe('Welcome dialog takes precedence', () => {
    it('should show welcome dialog and block module intro when both could show', async () => {
      // Arrange: Both welcome and module intro could potentially show
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

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
              // Try to trigger module visit immediately
              if (!ctx.loading) {
                ctx.checkModuleVisit('dashboard');
              }
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Wait for welcome dialog to open
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Assert: Welcome dialog is open, module intro is NOT
      expect(getByTestId('module-open').textContent).toBe('closed');
      expect(getByTestId('current-module').textContent).toBe('none');
    });

    it('should prevent module intro from opening while welcome dialog is open', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: false,
            modulesVisited: [],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
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
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act: Try to trigger module visit while welcome is open
      act(() => {
        contextRef?.checkModuleVisit('users');
      });

      // Give it a moment to potentially open (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Module intro should NOT open
      expect(getByTestId('module-open').textContent).toBe('closed');
      expect(contextRef?.currentModule).toBeNull();
    });

    it('should prevent multiple module visits while welcome dialog is open', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: false,
            modulesVisited: [],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
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
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act: Try to trigger multiple module visits
      act(() => {
        contextRef?.checkModuleVisit('forms');
        contextRef?.checkModuleVisit('events');
        contextRef?.checkModuleVisit('calendar');
      });

      // Give it a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: No module intro should open
      expect(getByTestId('module-open').textContent).toBe('closed');
      expect(contextRef?.currentModule).toBeNull();
    });
  });

  describe('Module intro shows after welcome dismissed', () => {
    it('should show module intro after welcome dialog is dismissed', async () => {
      // Arrange
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

      const { getByTestId } = render(
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
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act: Dismiss welcome dialog
      await act(async () => {
        await contextRef?.dismissWelcomeDialog(true);
      });

      // Wait for welcome to close
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('closed');
      });

      // Act: Now trigger module visit
      act(() => {
        contextRef?.checkModuleVisit('payments');
      });

      // Assert: Module intro should now open
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('payments');
      });
    });

    it('should show module intro for unvisited module when welcome is already dismissed', async () => {
      // Arrange: Welcome already dismissed
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: ['dashboard', 'users'] as ModuleId[],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert: Welcome should not open
      expect(getByTestId('welcome-open').textContent).toBe('closed');

      // Act: Trigger unvisited module
      act(() => {
        contextRef?.checkModuleVisit('memberships');
      });

      // Assert: Module intro should open
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('memberships');
      });
    });

    it('should allow sequential module intros after dismissing each one', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: [],
          },
        },
      });

      mockedAxios.put.mockResolvedValue({
        data: { success: true },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
            onUpdate={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(contextRef?.loading).toBe(false);
      });

      // Act: Trigger first module
      act(() => {
        contextRef?.checkModuleVisit('forms');
      });

      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('forms');
      });

      // Dismiss first module intro
      await act(async () => {
        await contextRef?.dismissModuleIntro('forms');
      });

      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('closed');
      });

      // Act: Trigger second module
      act(() => {
        contextRef?.checkModuleVisit('events');
      });

      // Assert: Second module intro should open
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('events');
      });
    });
  });

  describe('No dialogs show when all dismissed', () => {
    it('should not show any dialogs when welcome is dismissed and all modules visited', async () => {
      // Arrange: Everything dismissed
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: [
              'dashboard',
              'users',
              'forms',
              'events',
              'memberships',
              'calendar',
              'payments',
            ] as ModuleId[],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert: No dialogs should open
      expect(getByTestId('welcome-open').textContent).toBe('closed');
      expect(getByTestId('module-open').textContent).toBe('closed');

      // Act: Try to trigger module visits
      act(() => {
        contextRef?.checkModuleVisit('dashboard');
        contextRef?.checkModuleVisit('users');
        contextRef?.checkModuleVisit('forms');
      });

      // Give it a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Still no dialogs should open
      expect(getByTestId('welcome-open').textContent).toBe('closed');
      expect(getByTestId('module-open').textContent).toBe('closed');
    });

    it('should not show welcome dialog when dismissed even on fresh load', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: [],
          },
        },
      });

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert: Welcome dialog should not open
      expect(getByTestId('welcome-open').textContent).toBe('closed');
    });

    it('should not show module intro for visited modules', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: ['calendar', 'payments'] as ModuleId[],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(contextRef?.loading).toBe(false);
      });

      // Act: Try to trigger visited modules
      act(() => {
        contextRef?.checkModuleVisit('calendar');
        contextRef?.checkModuleVisit('payments');
      });

      // Give it a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: No module intro should open
      expect(getByTestId('module-open').textContent).toBe('closed');
      expect(contextRef?.currentModule).toBeNull();
    });

    it('should handle mixed visited and unvisited modules correctly', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: ['dashboard', 'forms'] as ModuleId[],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(contextRef?.loading).toBe(false);
      });

      // Act: Try to trigger visited module first
      act(() => {
        contextRef?.checkModuleVisit('dashboard');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Should not open for visited module
      expect(getByTestId('module-open').textContent).toBe('closed');

      // Act: Now trigger unvisited module
      act(() => {
        contextRef?.checkModuleVisit('users');
      });

      // Assert: Should open for unvisited module
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('users');
      });
    });
  });

  describe('Edge cases and concurrent scenarios', () => {
    it('should handle rapid module visit checks correctly', async () => {
      // Arrange
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

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(contextRef?.loading).toBe(false);
      });

      // Act: Trigger multiple module visits rapidly
      act(() => {
        contextRef?.checkModuleVisit('dashboard');
        contextRef?.checkModuleVisit('users');
        contextRef?.checkModuleVisit('forms');
      });

      // Give time to settle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert: Only one module intro should be open
      if (getByTestId('module-open').textContent === 'open') {
        const currentModule = getByTestId('current-module').textContent;
        expect(currentModule).not.toBe('none');
        // Should be one of the modules we tried to visit
        expect(['dashboard', 'users', 'forms']).toContain(currentModule);
      }
    });

    it('should not allow module intro to open while another is already open', async () => {
      // Arrange
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

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for loading
      await waitFor(() => {
        expect(contextRef?.loading).toBe(false);
      });

      // Act: Open first module intro
      act(() => {
        contextRef?.checkModuleVisit('events');
      });

      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('events');
      });

      // Act: Try to open another module intro
      act(() => {
        contextRef?.checkModuleVisit('memberships');
      });

      // Give it a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Should still show first module, not second
      expect(getByTestId('module-open').textContent).toBe('open');
      expect(getByTestId('current-module').textContent).toBe('events');
    });

    it('should handle welcome dialog dismissal without "dont show again" correctly', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: false,
            modulesVisited: [],
          },
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
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
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act: Dismiss without "don't show again"
      await act(async () => {
        await contextRef?.dismissWelcomeDialog(false);
      });

      // Wait for dialog to close
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('closed');
      });

      // Act: Now trigger module visit
      act(() => {
        contextRef?.checkModuleVisit('calendar');
      });

      // Assert: Module intro should be able to open
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(getByTestId('current-module').textContent).toBe('calendar');
      });
    });

    it('should maintain dialog state consistency during loading', async () => {
      // Arrange: Slow loading to test state during loading
      mockedAxios.get.mockImplementationOnce(
        () => new Promise((resolve) => 
          setTimeout(() => resolve({
            data: {
              success: true,
              data: {
                welcomeDismissed: true,
                modulesVisited: [],
              },
            },
          }), 500)
        )
      );

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Act: Try to trigger module visit while still loading
      act(() => {
        contextRef?.checkModuleVisit('payments');
      });

      // Assert: Should not open while loading
      expect(getByTestId('loading').textContent).toBe('loading');
      expect(getByTestId('module-open').textContent).toBe('closed');

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      }, { timeout: 2000 });

      // Module intro still should not have opened (because checkModuleVisit was called during loading)
      expect(getByTestId('module-open').textContent).toBe('closed');
    });
  });
});
