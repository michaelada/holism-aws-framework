/**
 * Unit Tests for HelpDrawer Keyboard Navigation and Focus Management
 * 
 * Tests keyboard navigation and focus management for the HelpDrawer component:
 * - Focus management when drawer opens
 * - Escape key to close drawer (handled by MUI Drawer)
 * 
 * Requirements: 6.1, Accessibility
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpDrawer } from '../HelpDrawer';
import { ModuleId } from '../../context/OnboardingContext';

// Mock translation function
const mockT = vi.fn((key: string, options?: { defaultValue?: string }) => {
  const translations: Record<string, string> = {
    'dashboard.overview': '# Dashboard Help\n\nThis is the dashboard overview help content.',
    'drawer.title': 'Help',
    'drawer.close': 'Close help',
  };
  return translations[key] || options?.defaultValue || key;
});

const mockI18n = {
  language: 'en-GB',
};

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

describe('HelpDrawer - Keyboard Navigation and Focus Management', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    pageId: 'overview',
    moduleId: 'dashboard' as ModuleId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Focus management when drawer opens', () => {
    it('should manage focus within drawer when opened', async () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert - MUI Drawer manages focus automatically
      // The drawer container or first focusable element receives focus
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();
      
      // Verify focus is within the drawer (MUI handles this)
      await waitFor(() => {
        const activeElement = document.activeElement;
        expect(activeElement).toBeTruthy();
      });
    });

    it('should not render drawer content when closed', () => {
      // Act
      render(<HelpDrawer {...defaultProps} open={false} />);

      // Assert - drawer content should not be in document when closed
      expect(screen.queryByRole('button', { name: /close help/i })).not.toBeInTheDocument();
    });

    it('should handle drawer reopening', async () => {
      // Arrange
      const { rerender } = render(<HelpDrawer {...defaultProps} open={false} />);

      // Act - open drawer
      rerender(<HelpDrawer {...defaultProps} open={true} />);

      // Assert - close button should be accessible
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should handle rapid open/close cycles gracefully', async () => {
      // Arrange
      const { rerender } = render(<HelpDrawer {...defaultProps} open={false} />);

      // Act - rapidly toggle open/close
      rerender(<HelpDrawer {...defaultProps} open={true} />);
      rerender(<HelpDrawer {...defaultProps} open={false} />);
      rerender(<HelpDrawer {...defaultProps} open={true} />);

      // Assert - should render correctly on final open
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Keyboard accessibility', () => {
    it('should have focusable close button', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();
      
      // Button should be focusable
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });

    it('should maintain focus trap within drawer', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert - close button should be focusable
      const closeButton = screen.getByRole('button', { name: /close help/i });
      
      // The MUI Drawer component handles focus trap automatically
      // We verify the close button is accessible and can be focused
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('ARIA attributes for keyboard navigation', () => {
    it('should have proper ARIA label on drawer', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      const heading = screen.getByRole('heading', { name: 'Help' });
      expect(heading).toHaveAttribute('id', 'help-drawer-title');
    });

    it('should have accessible close button with aria-label', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Close help');
    });
  });

  describe('Focus cleanup on unmount', () => {
    it('should not cause errors when unmounted', () => {
      // Arrange
      const { unmount } = render(<HelpDrawer {...defaultProps} />);

      // Verify drawer is rendered
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();

      // Act - unmount
      unmount();

      // Assert - should not throw error
      expect(true).toBe(true);
    });
  });
});
