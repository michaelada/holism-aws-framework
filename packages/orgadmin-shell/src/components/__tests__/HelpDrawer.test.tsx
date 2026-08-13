/**
 * Unit Tests for HelpDrawer Component
 *
 * Tests specific examples and edge cases for the HelpDrawer component.
 * Covers drawer opening/closing, content resolution, and scrolling with long
 * content.
 *
 * Help content no longer lives in the translation JSON: it is a set of markdown
 * files loaded by `getHelpContent`, which owns the page → module-overview →
 * en-GB fallback chain. So the drawer is tested for what it does with what the
 * loader returns, and the fallback chain itself is tested against the real
 * bundled content in `locales/__tests__/helpLoader.test.ts`.
 *
 * Requirements: 3.4, 3.5, 8.3, 8.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpDrawer } from '../HelpDrawer';
import { ModuleId } from '../../context/OnboardingContext';
import { getHelpContent } from '../../locales/helpLoader';

vi.mock('../../locales/helpLoader', () => ({
  getHelpContent: vi.fn(),
}));

const mockGetHelpContent = vi.mocked(getHelpContent);

/** What the loader would return for the fixtures these tests use. */
const HELP: Record<string, string> = {
  'dashboard/overview': '# Dashboard Help\n\nThis is the dashboard overview help content.',
  'dashboard/widgets': '# Widget Help\n\nThis is widget-specific help content.',
  'users/overview': '# Users Help\n\nThis is the users module overview.',
  'users/list': '# User List Help\n\nThis is user list page help.',
};

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

    // Stands in for the markdown loader; its own fallback chain is tested
    // separately, so this only needs to answer what a page asks for.
    mockGetHelpContent.mockImplementation(
      (_locale: string, moduleId: string, pageId: string) =>
        HELP[`${moduleId}/${pageId}`] ?? null
    );

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

    it('should ask the loader for this page, in the current language', () => {
      // Act
      render(<HelpDrawer {...defaultProps} pageId="widgets" moduleId="dashboard" />);

      // Assert - the language matters: the loader falls back to en-GB itself
      expect(mockGetHelpContent).toHaveBeenCalledWith('en-GB', 'dashboard', 'widgets');
    });

    it('should ask in the language the user is reading in', () => {
      // Arrange
      mockI18n.language = 'fr-FR';

      // Act
      render(<HelpDrawer {...defaultProps} pageId="overview" moduleId="dashboard" />);

      // Assert
      expect(mockGetHelpContent).toHaveBeenCalledWith('fr-FR', 'dashboard', 'overview');
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

  describe('Content resolution - whatever the loader resolved', () => {
    /**
     * The drawer renders what it is given; the page → overview → en-GB chain
     * behind this is the loader's, and is tested there.
     */
    it('should display module overview content when that is what came back', async () => {
      // Arrange - the loader answered a page-specific request with the overview
      mockGetHelpContent.mockReturnValue(HELP['dashboard/overview']);

      // Act
      render(<HelpDrawer {...defaultProps} pageId="nonexistent" moduleId="dashboard" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      });
      expect(screen.getByText(/dashboard overview help content/i)).toBeInTheDocument();
    });

    it('should display content for different modules', async () => {
      // Act
      render(<HelpDrawer {...defaultProps} pageId="list" moduleId="users" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('User List Help')).toBeInTheDocument();
      });
    });
  });

  describe('Content resolution - language', () => {
    it('should display the translated content the loader returned', async () => {
      // Arrange
      mockI18n.language = 'fr-FR';
      mockGetHelpContent.mockReturnValue(
        '# Aide du Tableau de Bord\n\nCeci est le contenu d\'aide du tableau de bord.'
      );

      // Act
      render(<HelpDrawer {...defaultProps} pageId="overview" moduleId="dashboard" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Aide du Tableau de Bord')).toBeInTheDocument();
      });
    });

    it('should display en-GB content when that is what the loader fell back to', async () => {
      // Arrange - French reader, content only written in English
      mockI18n.language = 'fr-FR';
      mockGetHelpContent.mockReturnValue(HELP['dashboard/widgets']);

      // Act
      render(<HelpDrawer {...defaultProps} pageId="widgets" moduleId="dashboard" />);

      // Assert - wait for lazy loading
      await waitFor(() => {
        expect(screen.getByText('Widget Help')).toBeInTheDocument();
      });
    });
  });

  describe('Content resolution - complete fallback chain', () => {
    /** No markdown exists for the module at all — say so rather than show a blank drawer. */
    it('should show fallback message when no content available', async () => {
      // Arrange
      mockGetHelpContent.mockReturnValue(null);

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
      mockGetHelpContent.mockReturnValue(
        '# Long Content\n\n' + 'This is a paragraph. '.repeat(100)
      );

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
