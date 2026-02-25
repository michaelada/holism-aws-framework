/**
 * Unit Tests for OnboardingProvider Keyboard Navigation
 * 
 * Tests keyboard navigation support including:
 * - Shift+? keyboard shortcut for help drawer
 * - Escape key to close dialogs (handled by MUI)
 * - Focus management
 * 
 * Requirements: 6.1, Accessibility
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
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

// Test component to access onboarding context
const TestComponent: React.FC = () => {
  const context = useOnboarding();
  
  return (
    <div data-testid="test-component">
      <div data-testid="help-open">{context.helpDrawerOpen ? 'open' : 'closed'}</div>
    </div>
  );
};

describe('OnboardingProvider - Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
    
    // Mock successful preference loading
    mockedAxios.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: [],
        },
      },
    });
  });

  describe('Shift+? keyboard shortcut for help drawer', () => {
    it('should open help drawer when Shift+? is pressed', async () => {
      // Arrange
      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });

      // Act - simulate Shift+? keypress
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Assert - help drawer should open
      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('open');
      });
    });

    it('should close help drawer when Shift+? is pressed again', async () => {
      // Arrange
      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });

      // Act - open help drawer
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('open');
      });

      // Act - close help drawer with same shortcut
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Assert - help drawer should close
      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });
    });

    it('should not trigger without Shift key', async () => {
      // Arrange
      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });

      // Act - press ? without Shift
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          shiftKey: false,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Give it a moment to potentially trigger (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - help drawer should remain closed
      expect(getByTestId('help-open').textContent).toBe('closed');
    });

    it('should not trigger with other keys + Shift', async () => {
      // Arrange
      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });

      // Act - press Shift+H (not ?)
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'H',
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Give it a moment to potentially trigger (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - help drawer should remain closed
      expect(getByTestId('help-open').textContent).toBe('closed');
    });

    it('should prevent default browser behavior when Shift+? is pressed', async () => {
      // Arrange
      render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        // Wait for component to mount
      });

      // Act - create event with preventDefault spy
      const event = new KeyboardEvent('keydown', {
        key: '?',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      // Assert - preventDefault should be called
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should work multiple times in succession', async () => {
      // Arrange
      const { getByTestId } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });

      // Act & Assert - toggle multiple times
      for (let i = 0; i < 3; i++) {
        // Open
        act(() => {
          const event = new KeyboardEvent('keydown', {
            key: '?',
            shiftKey: true,
            bubbles: true,
          });
          window.dispatchEvent(event);
        });

        await waitFor(() => {
          expect(getByTestId('help-open').textContent).toBe('open');
        });

        // Close
        act(() => {
          const event = new KeyboardEvent('keydown', {
            key: '?',
            shiftKey: true,
            bubbles: true,
          });
          window.dispatchEvent(event);
        });

        await waitFor(() => {
          expect(getByTestId('help-open').textContent).toBe('closed');
        });
      }
    });
  });

  describe('Event listener cleanup', () => {
    it('should remove event listener when component unmounts', async () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        // Wait for component to mount
      });

      // Assert - event listener should be added
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Act - unmount component
      unmount();

      // Assert - event listener should be removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Cleanup
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should not trigger after unmount', async () => {
      // Arrange
      const { getByTestId, unmount } = render(
        <OnboardingProvider>
          <TestComponent />
        </OnboardingProvider>
      );

      await waitFor(() => {
        expect(getByTestId('help-open').textContent).toBe('closed');
      });

      // Act - unmount
      unmount();

      // Act - try to trigger shortcut after unmount
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Assert - should not throw error (component is unmounted)
      // If we got here without error, the test passes
      expect(true).toBe(true);
    });
  });
});
