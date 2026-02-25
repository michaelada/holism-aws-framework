/**
 * Integration Test: First Login Flow
 * 
 * Tests the complete first login experience including:
 * - Welcome dialog appears for new user
 * - Dismissing with "don't show again"
 * - Preference is saved to backend
 * - Dialog doesn't appear on next login
 * 
 * Validates: Requirements 1.1, 1.3, 1.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { useOnboarding } from '../../context/OnboardingContext';
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
    'welcome.title': 'Welcome to OrgAdmin',
    'welcome.content': '# Welcome\n\nThis is your first time logging in.',
    'welcome.dontShowAgain': "Don't show this again",
    'translation:common.actions.close': 'Close',
  };
  return translations[key] || key;
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

// Test component that provides access to onboarding context
const TestApp: React.FC = () => {
  const { welcomeDialogOpen, dismissWelcomeDialog } = useOnboarding();
  
  return (
    <div data-testid="test-app">
      <div data-testid="welcome-status">
        {welcomeDialogOpen ? 'welcome-open' : 'welcome-closed'}
      </div>
      <button 
        data-testid="manual-dismiss"
        onClick={() => dismissWelcomeDialog(true)}
      >
        Dismiss Welcome
      </button>
    </div>
  );
};

describe('First Login Flow - Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
  });

  it('should show welcome dialog for new user on first login', async () => {
    // Arrange - simulate new user with no preferences
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app with OnboardingProvider
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Assert - welcome dialog should appear after preferences load
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-status').textContent).toBe('welcome-open');

    // Verify API was called to load preferences
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/user-preferences/onboarding',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-token-123',
        },
      })
    );
  });

  it('should dismiss welcome dialog with "dont show again" and save preference', async () => {
    // Arrange - new user
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

    // Act - render and wait for dialog
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Act - check "don't show again" and close
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Assert - dialog should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('welcome-status').textContent).toBe('welcome-closed');

    // Assert - preference should be saved to backend
    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(
        '/api/user-preferences/onboarding',
        { welcomeDismissed: true },
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
        })
      );
    });
  });

  it('should not show welcome dialog on subsequent login after dismissal', async () => {
    // Arrange - returning user who dismissed welcome dialog
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app (simulating second login)
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Give it time to potentially show dialog (it shouldn't)
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert - welcome dialog should NOT appear
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('welcome-status').textContent).toBe('welcome-closed');

    // Verify no PUT request was made (no need to save again)
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });

  it('should complete full first login flow: show, dismiss, save, and not show again', async () => {
    // Arrange - first login
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

    // Act - first login
    const { unmount } = render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Assert - dialog appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Act - dismiss with "don't show again"
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Assert - dialog closes and preference saved
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(
        '/api/user-preferences/onboarding',
        { welcomeDismissed: true },
        expect.any(Object)
      );
    });

    // Cleanup first render
    unmount();

    // Arrange - second login (simulate user logging in again)
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true, // Now dismissed
          modulesVisited: [],
        },
      },
    });

    // Act - second login
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Give it time to potentially show dialog
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert - dialog does NOT appear on second login
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('welcome-status').textContent).toBe('welcome-closed');
  });

  it('should handle dismissal without "dont show again" - dialog closes but preference not saved', async () => {
    // Arrange - new user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render and wait for dialog
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Act - close WITHOUT checking "don't show again"
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Assert - dialog should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Assert - preference should NOT be saved (no PUT request)
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });

  it('should handle API failure gracefully - show dialog by default', async () => {
    // Arrange - API fails to load preferences
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Assert - welcome dialog should appear (fail-safe behavior)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
  });

  it('should handle save failure gracefully - dialog closes but error logged', async () => {
    // Arrange - new user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Mock PUT to fail
    mockedAxios.put.mockRejectedValueOnce(new Error('Save failed'));

    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act - render and dismiss with "don't show again"
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Assert - dialog should still close despite save failure
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Assert - error should be logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save welcome dialog preference:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('should persist preference across page reloads', async () => {
    // Arrange - first load, new user
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

    // Act - first load
    const { unmount } = render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Dismiss with "don't show again"
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

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
          welcomeDismissed: true, // Backend returns saved preference
          modulesVisited: [],
        },
      },
    });

    // Act - reload
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Give it time to potentially show dialog
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert - dialog should not appear after reload
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('welcome-status').textContent).toBe('welcome-closed');
  });

  it('should handle empty/null preferences from backend', async () => {
    // Arrange - backend returns null/empty data
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: null, // No preferences yet
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestApp />
      </OnboardingProvider>
    );

    // Assert - should use default preferences and show welcome dialog
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
  });
});
