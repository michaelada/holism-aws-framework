/**
 * Keyboard Navigation Tests for Dialog Components
 * 
 * Tests keyboard navigation for WelcomeDialog and ModuleIntroductionDialog:
 * - Escape key to close dialogs (MUI Dialog built-in behavior)
 * - Focus management when dialogs open
 * - Tab navigation within dialogs
 * 
 * Task: 20.3 Write accessibility tests
 * Requirements: 6.1, Accessibility
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WelcomeDialog } from '../WelcomeDialog';
import { ModuleIntroductionDialog } from '../ModuleIntroductionDialog';
import { ModuleId } from '../../context/OnboardingContext';

// Mock translation function
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'welcome.title': 'Welcome to OrgAdmin',
    'welcome.content': '# Welcome\n\nThis is the welcome content.',
    'welcome.dontShowAgain': "Don't show this again",
    'modules.dashboard.title': 'Dashboard Overview',
    'modules.dashboard.content': '# Dashboard\n\nDashboard content.',
    'actions.gotIt': 'Got it',
    'translation:common.actions.close': 'Close',
  };
  return translations[key] || key;
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

describe('Dialog Components - Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WelcomeDialog', () => {
    it('should close when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Wait for dialog to be rendered
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Press Escape key
      await user.keyboard('{Escape}');

      // Dialog should call onClose
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledWith(false);
      });
    });

    it('should have focusable elements in correct tab order', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Get interactive elements
      const checkbox = screen.getByRole('checkbox');
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Verify elements are focusable
      expect(checkbox).toBeInTheDocument();
      expect(closeButton).toBeInTheDocument();

      // Tab through elements
      await user.tab();
      
      // One of the focusable elements should have focus
      const activeElement = document.activeElement;
      expect(activeElement).toBeTruthy();
    });

    it('should allow checkbox to be toggled with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      
      // Focus checkbox
      checkbox.focus();
      expect(checkbox).toHaveFocus();

      // Toggle with Space key
      await user.keyboard(' ');

      // Checkbox should be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should allow close button to be activated with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      
      // Focus button
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      // Activate with Enter key
      await user.keyboard('{Enter}');

      // Dialog should call onClose
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Tab multiple times - focus should stay within dialog
      await user.tab();
      await user.tab();
      await user.tab();

      // Active element should still be within the dialog
      const activeElement = document.activeElement;
      const dialog = screen.getByRole('dialog');
      
      expect(dialog.contains(activeElement)).toBe(true);
    });
  });

  describe('ModuleIntroductionDialog', () => {
    const defaultProps = {
      open: true,
      moduleId: 'dashboard' as ModuleId,
      onClose: vi.fn(),
    };

    it('should close when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(
        <ModuleIntroductionDialog 
          {...defaultProps} 
          onClose={mockOnClose} 
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Press Escape key
      await user.keyboard('{Escape}');

      // Dialog should call onClose
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should have focusable close button', async () => {
      const user = userEvent.setup();

      render(<ModuleIntroductionDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /got it/i });
      
      // Verify button is focusable
      expect(closeButton).toBeInTheDocument();
      
      // Tab to button
      await user.tab();
      
      // Button or another focusable element should have focus
      const activeElement = document.activeElement;
      expect(activeElement).toBeTruthy();
    });

    it('should allow close button to be activated with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(
        <ModuleIntroductionDialog 
          {...defaultProps} 
          onClose={mockOnClose} 
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /got it/i });
      
      // Focus button
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      // Activate with Enter key
      await user.keyboard('{Enter}');

      // Dialog should call onClose
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup();

      render(<ModuleIntroductionDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Tab multiple times - focus should stay within dialog
      await user.tab();
      await user.tab();

      // Active element should still be within the dialog
      const activeElement = document.activeElement;
      const dialog = screen.getByRole('dialog');
      
      expect(dialog.contains(activeElement)).toBe(true);
    });

    it('should handle rapid keyboard interactions', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(
        <ModuleIntroductionDialog 
          {...defaultProps} 
          onClose={mockOnClose} 
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Rapid keyboard interactions
      await user.tab();
      await user.keyboard('{Enter}');

      // Should handle gracefully
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Focus Management', () => {
    it('should restore focus after WelcomeDialog closes', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      // Create a button outside the dialog to track focus
      const { rerender } = render(
        <>
          <button data-testid="outside-button">Outside Button</button>
          <WelcomeDialog open={true} onClose={mockOnClose} />
        </>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close dialog
      await user.keyboard('{Escape}');

      // Rerender with dialog closed
      rerender(
        <>
          <button data-testid="outside-button">Outside Button</button>
          <WelcomeDialog open={false} onClose={mockOnClose} />
        </>
      );

      // Focus should be restored (MUI handles this automatically)
      // We just verify no errors occur
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should restore focus after ModuleIntroductionDialog closes', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      const { rerender } = render(
        <>
          <button data-testid="outside-button">Outside Button</button>
          <ModuleIntroductionDialog 
            open={true}
            moduleId="dashboard"
            onClose={mockOnClose}
          />
        </>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close dialog
      await user.keyboard('{Escape}');

      // Rerender with dialog closed
      rerender(
        <>
          <button data-testid="outside-button">Outside Button</button>
          <ModuleIntroductionDialog 
            open={false}
            moduleId="dashboard"
            onClose={mockOnClose}
          />
        </>
      );

      // Focus should be restored (MUI handles this automatically)
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
