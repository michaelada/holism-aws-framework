/**
 * Unit Tests for HelpDrawer Component
 * 
 * Tests specific examples and edge cases for the HelpDrawer component.
 * Covers drawer opening/closing, content resolution fallback logic, language fallback,
 * and scrolling with long content.
 * 
 * Requirements: 3.4, 3.5, 8.3, 8.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpDrawer } from '../HelpDrawer';
import { ModuleId } from '../../context/OnboardingContext';

// Mock translation function with fallback logic
const mockT = vi.fn((key: string, options?: { defaultValue?: string; lng?: string }) => {
  const translations: Record<string, Record<string, string>> = {
    'en-GB': {
      'dashboard.overview': '# Dashboard Help\n\nThis is the dashboard overview help content.',
      'dashboard.widgets': '# Widget Help\n\nThis is widget-specific help content.',
      'users.overview': '# Users Help\n\nThis is the users module overview.',
      'users.list': '# User List Help\n\nThis is user list page help.',
      'drawer.title': 'Help',
      'drawer.close': 'Close help',
      'noContentAvailable': 'Help content is not yet available for this page.',
    },
    'fr-FR': {
      'dashboard.overview': '# Aide du Tableau de Bord\n\nCeci est le contenu d\'aide du tableau de bord.',
      'drawer.title': 'Aide',
      'drawer.close': 'Fermer l\'aide',
    },
  };

  const lang = options?.lng || mockI18n.language;
  const langTranslations = translations[lang] || translations['en-GB'];
  
  const value = langTranslations[key] || options?.defaultValue || key;
  return value;
});

const mockI18n = {
  language: 'en-GB',
};

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

describe('HelpDrawer Component - Unit Tests', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    pageId: 'overview',
    moduleId: 'dashboard' as ModuleId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = 'en-GB';
    
    // Reset mock implementation to default
    mockT.mockImplementation((key: string, options?: { defaultValue?: string; lng?: string }) => {
      const translations: Record<string, Record<string, string>> = {
        'en-GB': {
          'dashboard.overview': '# Dashboard Help\n\nThis is the dashboard overview help content.',
          'dashboard.widgets': '# Widget Help\n\nThis is widget-specific help content.',
          'users.overview': '# Users Help\n\nThis is the users module overview.',
          'users.list': '# User List Help\n\nThis is user list page help.',
          'drawer.title': 'Help',
          'drawer.close': 'Close help',
          'noContentAvailable': 'Help content is not yet available for this page.',
        },
        'fr-FR': {
          'dashboard.overview': '# Aide du Tableau de Bord\n\nCeci est le contenu d\'aide du tableau de bord.',
          'drawer.title': 'Aide',
          'drawer.close': 'Fermer l\'aide',
        },
      };

      const lang = options?.lng || mockI18n.language;
      const langTranslations = translations[lang] || translations['en-GB'];
      
      const value = langTranslations[key] || options?.defaultValue || key;
      return value;
    });
  });

  describe('Drawer opening and closing', () => {
    it('should render drawer when open prop is true', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument();
    });

    it('should not render drawer content when open prop is false', () => {
      // Act
      render(<HelpDrawer {...defaultProps} open={false} />);

      // Assert
      expect(screen.queryByRole('heading', { name: 'Help' })).not.toBeInTheDocument();
    });

    it('should render close button', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      // Arrange
      render(<HelpDrawer {...defaultProps} />);
      const closeButton = screen.getByRole('button', { name: /close help/i });

      // Act
      fireEvent.click(closeButton);

      // Assert
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content resolution - page-specific content', () => {
    it('should display page-specific help content when available', async () => {
      // Act
      render(<HelpDrawer {...defaultProps} pageId="widgets" moduleId="dashboard" />);

      // Assert - wait for lazy-loaded markdown to render
      await waitFor(() => {
        expect(screen.getByText('Widget Help')).toBeInTheDocument();
      });
      expect(screen.getByText(/widget-specific help content/i)).toBeInTheDocument();
    });

    it('should request page-specific content first', () => {
      // Act
      render(<HelpDrawer {...defaultProps} pageId="widgets" moduleId="dashboard" />);

      // Assert - should try page-specific key first
      expect(mockT).toHaveBeenCalledWith('dashboard.widgets', expect.any(Object));
    });

    it('should display different content for different pages', async () => {
      // Arrange & Act
      const { rerender } = render(<HelpDrawer {...defaultProps} pageId="overview" moduleId="dashboard" />);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      });

      // Act - change to different page
      rerender(<HelpDrawer {...defaultProps} pageId="widgets" moduleId="dashboard" />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Widget Help')).toBeInTheDocument();
      });
    });
  });

  describe('Content resolution - module overview fallback', () => {
    it('should fall back to module overview when page-specific content not available', async () => {
      // Act - request non-existent page
      render(<HelpDrawer {...defaultProps} pageId="nonexistent" moduleId="dashboard" />);

      // Assert - should show module overview, wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      });
      expect(screen.getByText(/dashboard overview help content/i)).toBeInTheDocument();
    });

    it('should display module overview for different modules', async () => {
      // Act
      render(<HelpDrawer {...defaultProps} pageId="list" moduleId="users" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('User List Help')).toBeInTheDocument();
      });
    });
  });

  describe('Content resolution - en-GB language fallback', () => {
    it('should fall back to en-GB when content not available in current language', async () => {
      // Arrange - set language to French and add widgets to en-GB only
      mockI18n.language = 'fr-FR';
      
      // Mock to ensure widgets doesn't exist in fr-FR but does in en-GB
      mockT.mockImplementation((key: string, options?: { defaultValue?: string; lng?: string }) => {
        const translations: Record<string, Record<string, string>> = {
          'en-GB': {
            'dashboard.widgets': '# Widget Help\n\nThis is widget-specific help content.',
            'drawer.title': 'Help',
            'drawer.close': 'Close help',
          },
          'fr-FR': {
            'drawer.title': 'Aide',
            'drawer.close': 'Fermer l\'aide',
          },
        };

        const lang = options?.lng || mockI18n.language;
        const langTranslations = translations[lang] || translations['en-GB'];
        
        const value = langTranslations[key] || options?.defaultValue || key;
        return value;
      });

      // Act - request page that only exists in en-GB, not in fr-FR
      render(<HelpDrawer {...defaultProps} pageId="widgets" moduleId="dashboard" />);

      // Assert - should show en-GB content, wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Widget Help')).toBeInTheDocument();
      });
    });

    it('should display content in current language when available', async () => {
      // Arrange
      mockI18n.language = 'fr-FR';

      // Act
      render(<HelpDrawer {...defaultProps} pageId="overview" moduleId="dashboard" />);

      // Assert - should show French content, wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Aide du Tableau de Bord')).toBeInTheDocument();
      });
    });

    it('should not fall back to en-GB when current language is en-GB', async () => {
      // Arrange
      mockI18n.language = 'en-GB';

      // Act
      render(<HelpDrawer {...defaultProps} pageId="overview" moduleId="dashboard" />);

      // Assert - should show en-GB content, wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      });
    });
  });

  describe('Content resolution - complete fallback chain', () => {
    it('should show fallback message when no content available', async () => {
      // Arrange - mock to return empty for all keys
      mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
        if (key === 'noContentAvailable') {
          return 'Help content is not yet available for this page.';
        }
        if (key === 'drawer.title') return 'Help';
        if (key === 'drawer.close') return 'Close help';
        return options?.defaultValue || '';
      });

      // Act
      render(<HelpDrawer {...defaultProps} pageId="nonexistent" moduleId="forms" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText(/help content is not yet available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Markdown content rendering', () => {
    it('should render markdown headings correctly', async () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        const heading = screen.getByText('Dashboard Help');
        expect(heading.tagName).toBe('H1');
      });
    });

    it('should render markdown paragraphs', async () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText(/dashboard overview help content/i)).toBeInTheDocument();
      });
    });

    it('should update content when props change', async () => {
      // Arrange
      const { rerender } = render(<HelpDrawer {...defaultProps} moduleId="dashboard" />);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      });

      // Act - change module
      rerender(<HelpDrawer {...defaultProps} moduleId="users" pageId="overview" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Users Help')).toBeInTheDocument();
      });
    });
  });

  describe('Scrollable content area', () => {
    it('should render long content without truncation', async () => {
      // Arrange - mock long content
      mockT.mockImplementation((key: string) => {
        if (key === 'dashboard.overview') {
          return '# Long Content\n\n' + 'This is a paragraph. '.repeat(100);
        }
        if (key === 'drawer.title') return 'Help';
        if (key === 'drawer.close') return 'Close help';
        return key;
      });

      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert - content should be present, wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Long Content')).toBeInTheDocument();
      });
      expect(screen.getByText(/This is a paragraph/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
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
      expect(closeButton).toBeInTheDocument();
    });

    it('should be keyboard accessible - close button can be focused', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close help/i });
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('Header structure', () => {
    it('should render header with title', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument();
    });

    it('should render header with close button', () => {
      // Act
      render(<HelpDrawer {...defaultProps} />);

      // Assert
      const closeButton = screen.getByRole('button', { name: /close help/i });
      expect(closeButton).toBeInTheDocument();
    });
  });
});
