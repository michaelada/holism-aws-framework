/**
 * Unit Tests for HelpButton Component
 * 
 * Tests button rendering, tooltip, click handling, and active state styling.
 * 
 * Requirements: 10.2, 10.3, 10.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpButton } from '../HelpButton';

// Mock translation function
const mockT = vi.fn((key: string, options?: { defaultValue?: string }) => {
  const translations: Record<string, string> = {
    'button.tooltip': 'Get help',
  };
  return translations[key] || options?.defaultValue || key;
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

describe('HelpButton Component - Unit Tests', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockT.mockClear();
    
    // Reset mock implementation
    mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'button.tooltip': 'Get help',
      };
      return translations[key] || options?.defaultValue || key;
    });
  });

  describe('Button rendering', () => {
    it('should render button correctly', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);

      // Assert
      const button = screen.getByRole('button', { name: /get help/i });
      expect(button).toBeInTheDocument();
    });

    it('should render HelpOutline icon', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);

      // Assert
      const button = screen.getByRole('button', { name: /get help/i });
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('data-testid', 'HelpOutlineIcon');
    });

    it('should have proper aria-label', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);

      // Assert
      const button = screen.getByRole('button', { name: /get help/i });
      expect(button).toHaveAttribute('aria-label', 'Get help');
    });
  });

  describe('Tooltip', () => {
    it('should display tooltip on hover', async () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Hover over button
      fireEvent.mouseOver(button);

      // Assert - tooltip should appear
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveTextContent('Get help');
      });
    });

    it('should use translation for tooltip text', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);

      // Assert - translation function should be called
      expect(mockT).toHaveBeenCalledWith('button.tooltip', { defaultValue: 'Get help' });
    });
  });

  describe('Click handling', () => {
    it('should call onClick when button is clicked', () => {
      // Arrange
      render(<HelpButton onClick={mockOnClick} active={false} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Act
      fireEvent.click(button);

      // Assert
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick multiple times for multiple clicks', () => {
      // Arrange
      render(<HelpButton onClick={mockOnClick} active={false} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Act
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Assert
      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Active state styling', () => {
    it('should apply primary color when active', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={true} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Assert - button should have primary color class
      expect(button).toHaveClass('MuiIconButton-colorPrimary');
    });

    it('should apply default color when not active', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Assert - button should not have primary color class
      expect(button).not.toHaveClass('MuiIconButton-colorPrimary');
    });

    it('should update styling when active prop changes', () => {
      // Arrange
      const { rerender } = render(<HelpButton onClick={mockOnClick} active={false} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Assert initial state
      expect(button).not.toHaveClass('MuiIconButton-colorPrimary');

      // Act - change to active
      rerender(<HelpButton onClick={mockOnClick} active={true} />);

      // Assert - should now have primary color
      expect(button).toHaveClass('MuiIconButton-colorPrimary');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);
      const button = screen.getByRole('button', { name: /get help/i });

      // Assert - button should be focusable
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe('Translation fallback', () => {
    it('should use default value when translation is missing', () => {
      // Arrange - mock to return empty string
      mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
        return options?.defaultValue || '';
      });

      // Act
      render(<HelpButton onClick={mockOnClick} active={false} />);

      // Assert - should still render with default value
      const button = screen.getByRole('button', { name: /get help/i });
      expect(button).toBeInTheDocument();
    });
  });
});
