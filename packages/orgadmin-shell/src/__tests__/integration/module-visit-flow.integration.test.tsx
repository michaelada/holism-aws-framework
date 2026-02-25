/**
 * Integration Test: Module Visit Flow
 * 
 * Tests the complete module visit experience including:
 * - Module intro appears on first visit
 * - Dismissing module intro
 * - Intro doesn't appear on subsequent visits
 * 
 * Validates: Requirements 2.1, 2.3, 2.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { useOnboarding } from '../../context/OnboardingContext';
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
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'modules.dashboard.title': 'Dashboard Overview',
    'modules.dashboard.content': '# Dashboard\n\nYour dashboard provides an overview.',
    'modules.users.title': 'User Management',
    'modules.users.content': '# Users\n\nManage your users here.',
    'modules.forms.title': 'Form Builder',
    'modules.forms.content': '# Forms\n\nCreate custom forms.',
    'actions.gotIt': 'Got it',
    'translation:common.actions.gotIt': 'Got it',
  };
  return translations[key] || key;
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

// Test component that simulates module navigation
const TestModuleApp: React.FC = () => {
  const { 
    moduleIntroDialogOpen, 
    currentModule,
    checkModuleVisit,
    dismissModuleIntro 
  } = useOnboarding();
  
  return (
    <>
      <div data-testid="test-module-app">
        <div data-testid="module-intro-status">
          {moduleIntroDialogOpen ? 'module-intro-open' : 'module-intro-closed'}
        </div>
        <div data-testid="current-module">
          {currentModule || 'none'}
        </div>
        <button 
          data-testid="visit-dashboard"
          onClick={() => checkModuleVisit('dashboard')}
        >
          Visit Dashboard
        </button>
        <button 
          data-testid="visit-users"
          onClick={() => checkModuleVisit('users')}
        >
          Visit Users
        </button>
        <button 
          data-testid="visit-forms"
          onClick={() => checkModuleVisit('forms')}
        >
          Visit Forms
        </button>
      </div>
      {/* Render the ModuleIntroductionDialog */}
      {currentModule && (
        <ModuleIntroductionDialog
          open={moduleIntroDialogOpen}
          moduleId={currentModule}
          onClose={() => dismissModuleIntro(currentModule)}
        />
      )}
    </>
  );
};

describe('Module Visit Flow - Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
  });

  it('should show module intro dialog on first visit to a module', async () => {
    // Arrange - user has not visited dashboard yet
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - visit dashboard for the first time
    const visitDashboardButton = screen.getByTestId('visit-dashboard');
    fireEvent.click(visitDashboardButton);

    // Assert - module intro dialog should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByTestId('module-intro-status').textContent).toBe('module-intro-open');
    expect(screen.getByTestId('current-module').textContent).toBe('dashboard');
  });

  it('should dismiss module intro and save preference', async () => {
    // Arrange - user has not visited dashboard yet
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

    // Act - render and visit dashboard
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    const visitDashboardButton = screen.getByTestId('visit-dashboard');
    fireEvent.click(visitDashboardButton);

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Act - dismiss the module intro
    const gotItButton = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItButton);

    // Assert - dialog should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('module-intro-status').textContent).toBe('module-intro-closed');

    // Assert - preference should be saved to backend
    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(
        '/api/user-preferences/onboarding',
        { modulesVisited: ['dashboard'] },
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
        })
      );
    });
  });

  it('should not show module intro on subsequent visits to the same module', async () => {
    // Arrange - user has already visited dashboard
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - visit dashboard again (already visited)
    const visitDashboardButton = screen.getByTestId('visit-dashboard');
    fireEvent.click(visitDashboardButton);

    // Give it time to potentially show dialog (it shouldn't)
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert - module intro dialog should NOT appear
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-intro-status').textContent).toBe('module-intro-closed');

    // Verify no PUT request was made (no need to save again)
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });

  it('should show different module intros for different modules', async () => {
    // Arrange - user has visited dashboard but not users
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    mockedAxios.put.mockResolvedValueOnce({
      data: { success: true },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - visit dashboard (already visited, should not show dialog)
    const visitDashboardButton = screen.getByTestId('visit-dashboard');
    fireEvent.click(visitDashboardButton);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert - no dialog for dashboard
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Act - visit users module (first time)
    const visitUsersButton = screen.getByTestId('visit-users');
    fireEvent.click(visitUsersButton);

    // Assert - users module intro should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByTestId('current-module').textContent).toBe('users');

    // Act - dismiss users intro
    const gotItButton = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Assert - preference should include both modules
    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(
        '/api/user-preferences/onboarding',
        { modulesVisited: ['dashboard', 'users'] },
        expect.any(Object)
      );
    });
  });

  it('should complete full module visit flow: first visit shows intro, subsequent visits do not', async () => {
    // Arrange - first visit to forms module
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

    // Act - first visit
    const { unmount } = render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Visit forms module
    const visitFormsButton = screen.getByTestId('visit-forms');
    fireEvent.click(visitFormsButton);

    // Assert - dialog appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Form Builder')).toBeInTheDocument();

    // Act - dismiss the intro
    const gotItButton = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItButton);

    // Assert - dialog closes and preference saved
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(
        '/api/user-preferences/onboarding',
        { modulesVisited: ['forms'] },
        expect.any(Object)
      );
    });

    // Cleanup first render
    unmount();

    // Arrange - second visit (simulate navigation back to forms)
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['forms'], // Now visited
        },
      },
    });

    // Act - second visit
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Visit forms module again
    const visitFormsButton2 = screen.getByTestId('visit-forms');
    fireEvent.click(visitFormsButton2);

    // Give it time to potentially show dialog
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert - dialog does NOT appear on second visit
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-intro-status').textContent).toBe('module-intro-closed');
  });

  it('should track multiple module visits independently', async () => {
    // Arrange - no modules visited yet
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

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Visit dashboard
    fireEvent.click(screen.getByTestId('visit-dashboard'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Visit users
    fireEvent.click(screen.getByTestId('visit-users'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Visit forms
    fireEvent.click(screen.getByTestId('visit-forms'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Assert - all three modules should be tracked
    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenLastCalledWith(
        '/api/user-preferences/onboarding',
        { modulesVisited: ['dashboard', 'users', 'forms'] },
        expect.any(Object)
      );
    });
  });

  it('should handle API failure gracefully when saving module visit', async () => {
    // Arrange - user has not visited dashboard yet
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: [],
        },
      },
    });

    // Mock PUT to fail
    mockedAxios.put.mockRejectedValueOnce(new Error('Save failed'));

    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act - render and visit dashboard
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('visit-dashboard'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Act - dismiss the intro
    const gotItButton = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItButton);

    // Assert - dialog should still close despite save failure
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Assert - error should be logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save module intro preference:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('should persist module visits across page reloads', async () => {
    // Arrange - first load, no modules visited
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

    // Act - first load
    const { unmount } = render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Visit dashboard and dismiss
    fireEvent.click(screen.getByTestId('visit-dashboard'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalled();
    });

    unmount();

    // Arrange - simulate page reload (new component mount)
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'], // Backend returns saved preference
        },
      },
    });

    // Act - reload
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Visit dashboard again
    fireEvent.click(screen.getByTestId('visit-dashboard'));

    // Give it time to potentially show dialog
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert - dialog should not appear after reload
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-intro-status').textContent).toBe('module-intro-closed');
  });

  it('should handle rapid module navigation without showing multiple dialogs', async () => {
    // Arrange - no modules visited yet
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

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestModuleApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - rapidly click multiple module buttons
    fireEvent.click(screen.getByTestId('visit-dashboard'));
    fireEvent.click(screen.getByTestId('visit-users'));
    fireEvent.click(screen.getByTestId('visit-forms'));

    // Assert - only one dialog should be shown (the first one - dashboard)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByTestId('current-module').textContent).toBe('dashboard');

    // Dismiss the dialog
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // The checkModuleVisit logic prevents showing another dialog if one is already open
    // After dismissing, the other modules were already "checked" but blocked
    // So we need to manually trigger them again to see the next dialog
    fireEvent.click(screen.getByTestId('visit-users'));

    // Now the users module intro should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('User Management')).toBeInTheDocument();
  });
});
