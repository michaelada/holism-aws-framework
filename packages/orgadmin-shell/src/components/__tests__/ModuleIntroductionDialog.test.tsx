/**
 * Unit tests for ModuleIntroductionDialog component
 * 
 * Tests verify:
 * - Dialog rendering for different modules
 * - Content loading from i18n translations
 * - Close button functionality
 * - Markdown content rendering
 * - Accessibility features
 * 
 * Requirements: 2.1, 2.3, 2.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModuleIntroductionDialog } from '../ModuleIntroductionDialog';
import type { ModuleId } from '../../context/OnboardingContext';

// Mock the useTranslation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Mock translations for testing - all 7 modules
      const translations: Record<string, string> = {
        'modules.dashboard.title': 'Dashboard Overview',
        'modules.dashboard.content': '# Dashboard\n\nYour dashboard provides an overview.',
        'modules.users.title': 'User Management',
        'modules.users.content': '# User Management\n\nManage all users.',
        'modules.forms.title': 'Form Builder',
        'modules.forms.content': '# Forms\n\nCreate custom forms for data collection.',
        'modules.events.title': 'Event Management',
        'modules.events.content': '# Events\n\nPlan and manage events.',
        'modules.memberships.title': 'Membership Management',
        'modules.memberships.content': '# Memberships\n\nManage membership programs.',
        'modules.calendar.title': 'Calendar & Bookings',
        'modules.calendar.content': '# Calendar\n\nManage bookable resources.',
        'modules.payments.title': 'Payment Processing',
        'modules.payments.content': '# Payments\n\nAccept and manage payments.',
        'translation:common.actions.gotIt': 'Got it',
        'actions.gotIt': 'Got it',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ModuleIntroductionDialog Component - Unit Tests', () => {
  describe('Dialog rendering when open', () => {
    it('should render dialog when open prop is true', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render dialog when open prop is false', () => {
      render(
        <ModuleIntroductionDialog
          open={false}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render title from i18n translation based on moduleId', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    });

    it('should render "Got it" button', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
    });
  });

  describe('Close behavior', () => {
    it('should call onClose when "Got it" button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={onClose}
        />
      );

      const button = screen.getByRole('button', { name: /got it/i });
      await user.click(button);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when dialog backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={onClose}
        />
      );

      // Click on the backdrop (the dialog container)
      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        await user.click(backdrop);
      }

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Module-specific content', () => {
    it('should render content for dashboard module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      expect(screen.getByText(/Your dashboard provides an overview/)).toBeInTheDocument();
    });

    it('should render content for users module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="users"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'User Management', level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/Manage all users/)).toBeInTheDocument();
    });

    it('should render content for forms module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="forms"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Form Builder', level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/Create custom forms for data collection/)).toBeInTheDocument();
    });

    it('should render content for events module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="events"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Event Management', level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/Plan and manage events/)).toBeInTheDocument();
    });

    it('should render content for memberships module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="memberships"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Membership Management', level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/Manage membership programs/)).toBeInTheDocument();
    });

    it('should render content for calendar module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="calendar"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Calendar & Bookings', level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/Manage bookable resources/)).toBeInTheDocument();
    });

    it('should render content for payments module', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="payments"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Payment Processing', level: 2 })).toBeInTheDocument();
      expect(screen.getByText(/Accept and manage payments/)).toBeInTheDocument();
    });

    it('should render different content for different modules', () => {
      const { rerender } = render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Dashboard Overview', level: 2 })).toBeInTheDocument();

      rerender(
        <ModuleIntroductionDialog
          open={true}
          moduleId="users"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'User Management', level: 2 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Dashboard Overview', level: 2 })).not.toBeInTheDocument();
    });
  });

  describe('Markdown content rendering', () => {
    it('should render markdown content from i18n translation', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      // Check that markdown heading is rendered
      const heading = screen.getByText('Dashboard');
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H1');
    });

    it('should render content inside dialog content area', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      const content = screen.getByText(/Your dashboard provides an overview/);
      
      expect(dialog).toContainElement(content);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label on dialog', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'module-intro-dialog-title');
    });

    it('should be keyboard accessible - close button can be focused', async () => {
      const user = userEvent.setup();
      
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /got it/i });
      
      // Tab to focus the button
      await user.tab();
      
      expect(button).toHaveFocus();
    });
  });

  describe('Dialog properties', () => {
    it('should render dialog with proper MUI Dialog component', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should render with proper dialog structure and content', () => {
      render(
        <ModuleIntroductionDialog
          open={true}
          moduleId="dashboard"
          onClose={vi.fn()}
        />
      );

      // Check for dialog title
      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      
      // Check for dialog content
      expect(screen.getByText(/Your dashboard provides an overview/)).toBeInTheDocument();
      
      // Check for dialog actions (button)
      expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
    });
  });
});
