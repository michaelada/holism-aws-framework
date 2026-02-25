/**
 * Unit Tests for OnboardingProvider
 * 
 * Tests specific examples and edge cases for the OnboardingProvider component.
 * Covers preference loading, error handling, state updates, and checkModuleVisit logic.
 * 
 * Requirements: 4.5
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
      <div data-testid="help-open">{context.helpDrawerOpen ? 'open' : 'closed'}</div>
      <div data-testid="current-module">{context.currentModule || 'none'}</div>
      <div data-testid="modules-visited">{context.preferences.modulesVisited.join(',')}</div>
    </div>
  );
};

describe('OnboardingProvider - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
  });

  describe('Preference loading on mount', () => {
    it('should load preferences from API on mount', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard', 'users'] as ModuleId[],
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockPreferences,
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      // Act
      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent
            onMount={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Assert - should start loading
      expect(getByTestId('loading').textContent).toBe('loading');

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert - preferences should be loaded
      expect(contextRef?.preferences).toEqual(mockPreferences);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/user-preferences/onboarding',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
        })
      );
    });

    it('should use default preferences when API returns empty data', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: null,
        },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      // Act
      render(
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
        expect(contextRef?.loading).toBe(false);
      });

      // Assert - should use default preferences
      expect(contextRef?.preferences).toEqual({
        welcomeDismissed: false,
        modulesVisited: [],
      });
    });

    it('should show welcome dialog after preferences load if not dismissed', async () => {
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

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert - welcome dialog should open
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });
    });

    it('should not show welcome dialog if already dismissed', async () => {
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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert - welcome dialog should remain closed
      expect(getByTestId('welcome-open').textContent).toBe('closed');
    });
  });

  describe('Error handling when API fails', () => {
    it('should use default preferences when API call fails', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      // Act
      render(
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
        expect(contextRef?.loading).toBe(false);
      });

      // Assert - should use default preferences (fail-safe)
      expect(contextRef?.preferences).toEqual({
        welcomeDismissed: false,
        modulesVisited: [],
      });
    });

    it('should show welcome dialog by default when API fails', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      // Assert - welcome dialog should open (fail-safe approach)
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });
    });

    it('should continue working when preference save fails', async () => {
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

      mockedAxios.put.mockRejectedValueOnce(new Error('Save failed'));

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

      // Wait for loading and dialog to open
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('loaded');
      });

      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act - dismiss dialog (this will fail to save)
      await act(async () => {
        await contextRef?.dismissWelcomeDialog(true);
      });

      // Assert - dialog should close despite save failure
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('closed');
      });
    });

    it('should handle 401 authentication errors gracefully', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401 },
        message: 'Unauthorized',
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      // Act
      render(
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
        expect(contextRef?.loading).toBe(false);
      });

      // Assert - should use default preferences
      expect(contextRef?.preferences).toEqual({
        welcomeDismissed: false,
        modulesVisited: [],
      });
    });
  });

  describe('State updates when dialogs dismissed', () => {
    it('should close welcome dialog when dismissed without "dont show again"', async () => {
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

      // Wait for dialog to open
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act - dismiss without "don't show again"
      await act(async () => {
        await contextRef?.dismissWelcomeDialog(false);
      });

      // Assert - dialog should close but not save preference
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('closed');
      });
      expect(mockedAxios.put).not.toHaveBeenCalled();
    });

    it('should close welcome dialog and save preference when dismissed with "dont show again"', async () => {
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
            onUpdate={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for dialog to open
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act - dismiss with "don't show again"
      await act(async () => {
        await contextRef?.dismissWelcomeDialog(true);
      });

      // Assert - dialog should close and preference saved
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('closed');
      });

      await waitFor(() => {
        expect(mockedAxios.put).toHaveBeenCalledWith(
          '/api/user-preferences/onboarding',
          { welcomeDismissed: true },
          expect.any(Object)
        );
      });

      // Local state should be updated
      await waitFor(() => {
        expect(contextRef?.preferences.welcomeDismissed).toBe(true);
      });
    });

    it('should close module intro dialog and save preference', async () => {
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

      // Act - trigger module visit
      await act(async () => {
        contextRef?.checkModuleVisit('dashboard');
      });

      // Wait for module dialog to open
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
      });

      // Act - dismiss module intro
      await act(async () => {
        await contextRef?.dismissModuleIntro('dashboard');
      });

      // Assert - dialog should close and preference saved
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('closed');
      });

      await waitFor(() => {
        expect(mockedAxios.put).toHaveBeenCalledWith(
          '/api/user-preferences/onboarding',
          { modulesVisited: ['dashboard'] },
          expect.any(Object)
        );
      });

      await waitFor(() => {
        expect(contextRef?.preferences.modulesVisited).toContain('dashboard');
        expect(contextRef?.currentModule).toBeNull();
      });
    });

    it('should merge module visits when dismissing multiple modules', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: ['dashboard'] as ModuleId[],
          },
        },
      });

      mockedAxios.put.mockResolvedValueOnce({
        data: { success: true },
      });

      let contextRef: ReturnType<typeof useOnboarding> | null = null;

      render(
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

      // Act - dismiss another module
      await act(async () => {
        await contextRef?.dismissModuleIntro('users');
      });

      // Assert - should merge with existing modules
      await waitFor(() => {
        expect(mockedAxios.put).toHaveBeenCalledWith(
          '/api/user-preferences/onboarding',
          { modulesVisited: expect.arrayContaining(['dashboard', 'users']) },
          expect.any(Object)
        );
      });

      await waitFor(() => {
        expect(contextRef?.preferences.modulesVisited).toEqual(
          expect.arrayContaining(['dashboard', 'users'])
        );
      });
    });

    it('should toggle help drawer state', async () => {
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

      // Assert - help drawer starts closed
      expect(getByTestId('help-open').textContent).toBe('closed');

      // Act - toggle open
      act(() => {
        contextRef?.toggleHelpDrawer();
      });

      // Assert - should be open
      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('open');
      });

      // Act - toggle closed
      act(() => {
        contextRef?.toggleHelpDrawer();
      });

      // Assert - should be closed
      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });
    });
  });

  describe('checkModuleVisit logic', () => {
    it('should show module intro for unvisited module', async () => {
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

      // Act - check module visit
      act(() => {
        contextRef?.checkModuleVisit('forms');
      });

      // Assert - module intro should open
      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(contextRef?.currentModule).toBe('forms');
      });
    });

    it('should not show module intro for already visited module', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            welcomeDismissed: true,
            modulesVisited: ['events'] as ModuleId[],
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

      // Act - check already visited module
      act(() => {
        contextRef?.checkModuleVisit('events');
      });

      // Assert - module intro should not open
      expect(getByTestId('module-open').textContent).toBe('closed');
      expect(contextRef?.currentModule).toBeNull();
    });

    it('should not show module intro while still loading', async () => {
      // Arrange
      mockedAxios.get.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
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

      // Act - try to check module while loading
      act(() => {
        contextRef?.checkModuleVisit('calendar');
      });

      // Assert - module intro should not open while loading
      expect(getByTestId('loading').textContent).toBe('loading');
      expect(getByTestId('module-open').textContent).toBe('closed');
    });

    it('should not show module intro when welcome dialog is open', async () => {
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
            onUpdate={(ctx) => {
              contextRef = ctx;
            }}
          />
        </OnboardingProvider>
      );

      // Wait for welcome dialog to open
      await waitFor(() => {
        expect(getByTestId('welcome-open').textContent).toBe('open');
      });

      // Act - try to check module while welcome dialog is open
      act(() => {
        contextRef?.checkModuleVisit('payments');
      });

      // Give it a moment to potentially open (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - module intro should not open (welcome has priority)
      expect(getByTestId('module-open').textContent).toBe('closed');
    });

    it('should not show module intro when another module intro is already open', async () => {
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

      // Act - open first module intro
      act(() => {
        contextRef?.checkModuleVisit('memberships');
      });

      await waitFor(() => {
        expect(getByTestId('module-open').textContent).toBe('open');
        expect(contextRef?.currentModule).toBe('memberships');
      });

      // Act - try to open another module intro
      act(() => {
        contextRef?.checkModuleVisit('calendar');
      });

      // Give it a moment to potentially change (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - should still show first module, not second
      expect(contextRef?.currentModule).toBe('memberships');
      expect(getByTestId('module-open').textContent).toBe('open');
    });

    it('should handle all valid module IDs', async () => {
      const moduleIds: ModuleId[] = [
        'dashboard',
        'users',
        'forms',
        'events',
        'memberships',
        'calendar',
        'payments',
      ];

      for (const moduleId of moduleIds) {
        // Arrange
        vi.clearAllMocks();
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

        const { unmount } = render(
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

        // Act - check module visit
        act(() => {
          contextRef?.checkModuleVisit(moduleId);
        });

        // Assert - module intro should open for this module
        await waitFor(() => {
          expect(contextRef?.currentModule).toBe(moduleId);
          expect(contextRef?.moduleIntroDialogOpen).toBe(true);
        });

        unmount();
      }
    });
  });
});
