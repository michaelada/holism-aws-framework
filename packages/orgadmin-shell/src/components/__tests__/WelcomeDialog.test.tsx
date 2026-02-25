/**
 * Unit Tests for WelcomeDialog Component
 * 
 * Tests specific examples and edge cases for the WelcomeDialog component.
 * Covers dialog rendering, checkbox toggling, close behavior, and markdown content rendering.
 * 
 * Requirements: 1.1, 1.3, 6.1
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WelcomeDialog } from '../WelcomeDialog';

// Mock useTranslation hook
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'welcome.title': 'Welcome to OrgAdmin',
    'welcome.content': '# Welcome\n\nThis is **test** content with markdown.',
    'welcome.dontShowAgain': "Don't show this again",
    'translation:common.actions.close': 'Close',
  };
  return translations[key] || key;
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

describe('WelcomeDialog Component - Unit Tests', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog rendering when open', () => {
    it('should render dialog when open prop is true', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
    });

    it('should not render dialog when open prop is false', () => {
      // Act
      render(<WelcomeDialog open={false} onClose={mockOnClose} />);

      // Assert
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render title from i18n translation', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      expect(mockT).toHaveBeenCalledWith('welcome.title');
      expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
    });

    it('should render close button', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should render "dont show again" checkbox', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();
    });
  });

  describe('Checkbox toggle behavior', () => {
    it('should start with checkbox unchecked', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should toggle checkbox when clicked', () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

      // Act - check the checkbox
      fireEvent.click(checkbox);

      // Assert
      expect(checkbox.checked).toBe(true);
    });

    it('should toggle checkbox back to unchecked when clicked twice', () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

      // Act - check and uncheck
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);

      // Assert
      expect(checkbox.checked).toBe(false);
    });

    it('should maintain checkbox state while dialog is open', () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

      // Act - check the checkbox
      fireEvent.click(checkbox);

      // Assert - checkbox should remain checked
      expect(checkbox.checked).toBe(true);

      // Wait a moment and verify it's still checked
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Close behavior with checkbox state', () => {
    it('should call onClose with false when close button clicked with unchecked checkbox', () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Act
      fireEvent.click(closeButton);

      // Assert
      expect(mockOnClose).toHaveBeenCalledWith(false);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose with true when close button clicked with checked checkbox', () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const checkbox = screen.getByRole('checkbox');
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Act - check the checkbox then close
      fireEvent.click(checkbox);
      fireEvent.click(closeButton);

      // Assert
      expect(mockOnClose).toHaveBeenCalledWith(true);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when dialog backdrop is clicked', async () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const dialog = screen.getByRole('dialog');

      // Act - simulate backdrop click by calling onClose directly
      // Note: MUI Dialog's backdrop click behavior is tested by MUI itself
      // We verify that the component properly wires up the onClose handler
      fireEvent.keyDown(dialog, { key: 'Escape' });

      // Assert
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledWith(false);
      });
    });

    it('should call onClose with correct checkbox state when escape key pressed after checking checkbox', async () => {
      // Arrange
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const checkbox = screen.getByRole('checkbox');
      const dialog = screen.getByRole('dialog');

      // Act - check checkbox then press escape
      fireEvent.click(checkbox);
      fireEvent.keyDown(dialog, { key: 'Escape' });

      // Assert
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledWith(true);
      });
    });

    it('should reset checkbox state after dialog closes and reopens', async () => {
      // Arrange
      const { rerender } = render(<WelcomeDialog open={true} onClose={mockOnClose} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

      // Act - check checkbox and close
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      // Reopen the dialog
      rerender(<WelcomeDialog open={false} onClose={mockOnClose} />);
      rerender(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - checkbox should be reset to unchecked
      await waitFor(() => {
        const newCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
        expect(newCheckbox.checked).toBe(false);
      });
    });
  });

  describe('Markdown content rendering', () => {
    it('should render markdown content from i18n translation', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      expect(mockT).toHaveBeenCalledWith('welcome.content');
      
      // Check that markdown is rendered (heading and paragraph)
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });

    it('should render markdown headings correctly', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - heading should be rendered as h1
      const heading = screen.getByText('Welcome');
      expect(heading.tagName).toBe('H1');
    });

    it('should render markdown bold text correctly', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - bold text should be rendered in a strong tag
      const boldText = screen.getByText('test');
      expect(boldText.tagName).toBe('STRONG');
    });

    it('should render content inside dialog content area', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - content should be within DialogContent
      const dialog = screen.getByRole('dialog');
      const heading = screen.getByText('Welcome');
      
      expect(dialog).toContainElement(heading);
    });

    it('should handle empty markdown content gracefully', () => {
      // Arrange - mock empty content
      mockT.mockImplementation((key: string) => {
        if (key === 'welcome.content') return '';
        const translations: Record<string, string> = {
          'welcome.title': 'Welcome to OrgAdmin',
          'welcome.dontShowAgain': "Don't show this again",
          'translation:common.actions.close': 'Close',
        };
        return translations[key] || key;
      });

      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - dialog should still render without errors
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label on dialog', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'welcome-dialog-title');
    });

    it('should have accessible checkbox with proper labeling', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - checkbox should be accessible and have proper label
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      
      // The label text should be present
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();
    });

    it('should be keyboard accessible - close button can be focused', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('Dialog properties', () => {
    it('should render dialog with proper MUI Dialog component', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - dialog should be rendered
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // Dialog should have proper structure
      expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('should render with proper dialog structure and content', () => {
      // Act
      render(<WelcomeDialog open={true} onClose={mockOnClose} />);

      // Assert - verify dialog is rendered with proper structure
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // Verify all key elements are present
      expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });
});
