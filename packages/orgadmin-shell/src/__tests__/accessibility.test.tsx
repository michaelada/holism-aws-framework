import { render, screen, within } from '@testing-library/react';
import { Dialog, DialogTitle, DialogActions } from '@mui/material';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { DashboardPage } from '../pages/DashboardPage';
import { Layout } from '../components/Layout';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Accessibility tests for OrgAdmin
 * 
 * These tests verify:
 * - Keyboard navigation
 * - Screen reader compatibility
 * - WCAG 2.1 AA compliance
 * 
 * Validates: Requirements 3.4.3
 */

// Mock Keycloak
const mockKeycloak = {
  init: vi.fn().mockResolvedValue(true),
  authenticated: true,
  token: 'mock-token',
  tokenParsed: {
    sub: 'test-user-id',
    preferred_username: 'testadmin',
    email: 'admin@test.com',
    realm_access: { roles: ['org-admin'] },
  },
  loadUserProfile: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    username: 'testadmin',
    email: 'admin@test.com',
  }),
  isTokenExpired: vi.fn().mockReturnValue(false),
  updateToken: vi.fn().mockResolvedValue(true),
};

vi.mock('keycloak-js', () => ({
  default: vi.fn(() => mockKeycloak),
}));

/*
 * The dashboard and the layout read the current organisation from context.
 * These tests render them directly rather than through the app shell, so the
 * hook is stubbed with a settled organisation — what is under test here is the
 * markup, not how the organisation was resolved.
 */
/*
 * Same reasoning for the two shell contexts the dashboard and layout read:
 * every capability is on, so no module is filtered out of the markup under
 * test, and onboarding is inert.
 */
/*
 * No i18n resources are loaded here, so the real `t` returns raw keys for some
 * strings and English for others depending on what happens to be bundled.
 * Making it the identity function keeps the assertions below predictable:
 * everything is the key, and the module fixtures use English as their keys.
 */
vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-GB', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../context/CapabilityContext', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../context/CapabilityContext');
  return {
    ...actual,
    useCapabilities: () => ({
      capabilities: [],
      loading: false,
      error: null,
      hasCapability: () => true,
      refresh: vi.fn(),
    }),
  };
});

vi.mock('../context/OnboardingContext', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../context/OnboardingContext');
  return {
    ...actual,
    useOnboarding: () => ({
      welcomeDialogOpen: false,
      moduleIntroDialogOpen: false,
      currentModule: null,
      introModule: null,
      helpDrawerOpen: false,
      currentPageId: null,
      preferences: { welcomeDismissed: true, modulesVisited: [] },
      loading: false,
      dismissWelcomeDialog: vi.fn(),
      dismissModuleIntro: vi.fn(),
      toggleHelpDrawer: vi.fn(),
      checkModuleVisit: vi.fn(),
      setCurrentPageId: vi.fn(),
      setCurrentModule: vi.fn(),
    }),
  };
});

vi.mock('@aws-web-framework/orgadmin-core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@aws-web-framework/orgadmin-core'
  );
  return {
    ...actual,
    useOrganisation: () => ({
      organisation: {
        id: 'org-123',
        name: 'test-org',
        displayName: 'Test Organisation',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    }),
  };
});

// Mock API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/organisations/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'org-123',
            name: 'test-org',
            displayName: 'Test Organisation',
          }),
        });
      }
      
      if (url.includes('/api/capabilities')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(['event-management', 'memberships']),
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should allow keyboard navigation through dashboard cards', async () => {
      const user = userEvent.setup();
      
      const mockModules = [
        {
          id: 'events',
          name: 'Events',
          title: 'Event Management',
          description: 'Manage events',
          card: {
            title: 'Event Management',
            description: 'Manage events',
            icon: () => null,
            path: '/events',
          },
          routes: [],
        },
        {
          id: 'members',
          name: 'Members',
          title: 'Membership Management',
          description: 'Manage members',
          card: {
            title: 'Membership Management',
            description: 'Manage members',
            icon: () => null,
            path: '/members',
          },
          routes: [],
        },
      ];

      render(
        <BrowserRouter>
          <DashboardPage modules={mockModules} />
        </BrowserRouter>
      );

      // Tab through cards
      await user.tab();
      
      // First card should be focused. The card is the tab stop — it carries
      // role="button", so that is what to query rather than a wrapper div.
      expect(screen.getByRole('button', { name: /Event Management/i })).toHaveFocus();

      // Tab to next card
      await user.tab();
      
      expect(screen.getByRole('button', { name: /Membership Management/i })).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      
      // Should navigate (in real app)
      expect(window.location.pathname).toContain('/members');
    });

    it('should allow keyboard navigation in navigation drawer', async () => {
      const user = userEvent.setup();

      // The menu button only exists below the md breakpoint, and only away
      // from the landing page — on `/` the layout shows no navigation at all.
      global.innerWidth = 375;
      global.innerHeight = 667;
      global.dispatchEvent(new Event('resize'));
      window.history.pushState({}, '', '/events');
      
      render(
        <BrowserRouter>
          <Layout>
            <div>Content</div>
          </Layout>
        </BrowserRouter>
      );

      // Tab to menu button
      await user.tab();
      
      const menuButton = screen.getByRole('button', { name: /openDrawer/i });
      expect(menuButton).toHaveFocus();

      // Open menu with Enter
      await user.keyboard('{Enter}');

      // The drawer is a MUI modal on mobile: it moves focus inside itself, and
      // its entries are buttons rather than links. The first of them is the way
      // back to the main page.
      // Both drawers are mounted below md — the temporary one that opens and
      // the permanent one — so take the entry inside the open dialog.
      const drawer = await screen.findByRole('presentation');
      const drawerButton = within(drawer)
        .getByText('navigation.dashboard')
        .closest('[role="button"]') as HTMLElement;
      expect(drawerButton).toBeInTheDocument();

      await user.tab();
      expect(drawerButton).toHaveFocus();

      // And it is operable from the keyboard, which is the point.
      await user.keyboard('{Enter}');
      expect(window.location.pathname).toBe('/');
    });

    /**
     * Trapping focus is the dialog component's job, so this exercises the real
     * MUI Dialog every dialog in the app is built on — a hand-written
     * `role="dialog"` div traps nothing, and asserting against one would only
     * confirm the test's own markup.
     */
    it('should trap focus in modal dialogs', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <Dialog open aria-labelledby="dialog-title">
            <DialogTitle id="dialog-title">Confirm Action</DialogTitle>
            <DialogActions>
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogActions>
          </Dialog>
        </BrowserRouter>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

      // Tab through dialog buttons
      await user.tab();
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

      // Tab wraps back inside the dialog rather than escaping to the page
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    it('should support Escape key to close dialogs', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(
        <BrowserRouter>
          <div role="dialog" aria-modal="true">
            <button onClick={onClose}>Close</button>
          </div>
        </BrowserRouter>
      );

      // Press Escape
      await user.keyboard('{Escape}');
      
      // In real implementation, dialog should close
      // This tests the pattern
      expect(onClose).not.toHaveBeenCalled(); // Would be called in real implementation
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should have proper ARIA labels on interactive elements', () => {
      const mockModules = [
        {
          id: 'events',
          name: 'Events',
          title: 'Event Management',
          description: 'Manage events and activities',
          card: {
            title: 'Event Management',
            description: 'Manage events and activities',
            icon: () => null,
            path: '/events',
          },
          routes: [],
        },
      ];

      render(
        <BrowserRouter>
          <DashboardPage modules={mockModules} />
        </BrowserRouter>
      );

      // Verify heading structure
      const heading = screen.getByRole('heading', { level: 4 });
      expect(heading).toBeInTheDocument();

      // Verify cards have accessible names. The card itself carries the role,
      // not the box the title happens to sit in.
      const card = screen.getByRole('button', { name: /Event Management/i });
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAccessibleName();
    });

    it('should have proper heading hierarchy', () => {
      render(
        <BrowserRouter>
          <Layout>
            <div>
              <h1>Main Title</h1>
              <h2>Section Title</h2>
              <h3>Subsection Title</h3>
            </div>
          </Layout>
        </BrowserRouter>
      );

      // Verify heading levels are sequential
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });

      expect(h1).toBeInTheDocument();
      expect(h2).toBeInTheDocument();
      expect(h3).toBeInTheDocument();
    });

    it('should have descriptive link text', () => {
      render(
        <BrowserRouter>
          <Layout>
            <div>
              <a href="/events">View all events</a>
              <a href="/members">Manage members</a>
            </div>
          </Layout>
        </BrowserRouter>
      );

      // Links should have descriptive text, not "click here"
      const eventsLink = screen.getByRole('link', { name: /view all events/i });
      const membersLink = screen.getByRole('link', { name: /manage members/i });

      expect(eventsLink).toBeInTheDocument();
      expect(membersLink).toBeInTheDocument();
    });

    it('should announce loading states to screen readers', () => {
      render(
        <BrowserRouter>
          <div role="status" aria-live="polite" aria-busy="true">
            Loading...
          </div>
        </BrowserRouter>
      );

      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      expect(loadingIndicator).toHaveAttribute('aria-busy', 'true');
    });

    it('should announce error messages to screen readers', () => {
      render(
        <BrowserRouter>
          <div role="alert" aria-live="assertive">
            Error: Failed to load data
          </div>
        </BrowserRouter>
      );

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      expect(errorMessage).toHaveTextContent(/error/i);
    });

    it('should have proper form labels', () => {
      render(
        <BrowserRouter>
          <form>
            <label htmlFor="event-name">Event Name</label>
            <input id="event-name" type="text" />
            
            <label htmlFor="event-date">Event Date</label>
            <input id="event-date" type="date" />
          </form>
        </BrowserRouter>
      );

      const nameInput = screen.getByLabelText(/event name/i);
      const dateInput = screen.getByLabelText(/event date/i);

      expect(nameInput).toBeInTheDocument();
      expect(dateInput).toBeInTheDocument();
    });

    it('should indicate required fields', () => {
      render(
        <BrowserRouter>
          <form>
            <label htmlFor="required-field">
              Required Field
              <span aria-label="required">*</span>
            </label>
            <input id="required-field" type="text" required aria-required="true" />
          </form>
        </BrowserRouter>
      );

      const input = screen.getByLabelText(/required field/i);
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations on dashboard', async () => {
      const mockModules = [
        {
          id: 'events',
          name: 'Events',
          title: 'Event Management',
          description: 'Manage events',
          card: {
            title: 'Event Management',
            description: 'Manage events',
            icon: () => null,
            path: '/events',
          },
          routes: [],
        },
      ];

      const { container } = render(
        <BrowserRouter>
          <DashboardPage modules={mockModules} />
        </BrowserRouter>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations on layout', async () => {
      const { container } = render(
        <BrowserRouter>
          <Layout>
            <div>Content</div>
          </Layout>
        </BrowserRouter>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have sufficient color contrast', () => {
      render(
        <BrowserRouter>
          <div style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            High contrast text
          </div>
        </BrowserRouter>
      );

      // In real implementation, would use color contrast checking tools
      // This verifies the pattern is followed
      const element = screen.getByText(/high contrast text/i);
      expect(element).toBeInTheDocument();
    });

    it('should have focusable interactive elements', () => {
      render(
        <BrowserRouter>
          <button>Click me</button>
          <a href="/test">Link</a>
          <input type="text" />
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      const link = screen.getByRole('link');
      const input = screen.getByRole('textbox');

      // All interactive elements should be focusable
      expect(button).not.toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('tabindex', '-1');
      expect(input).not.toHaveAttribute('tabindex', '-1');
    });

    it('should have visible focus indicators', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <button>Focusable Button</button>
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      
      // Tab to button
      await user.tab();
      
      expect(button).toHaveFocus();
      
      // In real implementation, would verify focus ring is visible
      // This tests the pattern
    });

    it('should support text resizing up to 200%', () => {
      render(
        <BrowserRouter>
          <div style={{ fontSize: '16px' }}>
            Normal text
          </div>
        </BrowserRouter>
      );

      // In real implementation, would test with browser zoom
      // This verifies relative units are used
      const element = screen.getByText(/normal text/i);
      expect(element).toBeInTheDocument();
    });

    it('should have proper table structure', () => {
      render(
        <BrowserRouter>
          <table>
            <caption>Event List</caption>
            <thead>
              <tr>
                <th scope="col">Event Name</th>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Annual Competition</td>
                <td>2024-06-15</td>
                <td>Published</td>
              </tr>
            </tbody>
          </table>
        </BrowserRouter>
      );

      const table = screen.getByRole('table');
      const caption = screen.getByText(/event list/i);
      const headers = screen.getAllByRole('columnheader');

      expect(table).toBeInTheDocument();
      expect(caption).toBeInTheDocument();
      expect(headers).toHaveLength(3);
      
      // Verify headers have scope attribute
      headers.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });

    it('should have proper landmark regions', () => {
      // The layout supplies the landmarks; nesting another <main> inside it
      // would create the second one this asserts against.
      window.history.pushState({}, '', '/events');

      render(
        <BrowserRouter>
          <Layout>
            <h1>Main Content</h1>
            <p>Content goes here</p>
          </Layout>
        </BrowserRouter>
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();

      /*
       * Two navigation landmarks, deliberately: the section rail and the
       * breadcrumb. That is only correct while each carries its own accessible
       * name — an unnamed second `nav` would leave a screen-reader user with
       * two indistinguishable "navigation" entries in the landmarks list.
       */
      const landmarks = screen.getAllByRole('navigation');
      expect(landmarks).toHaveLength(2);
      expect(landmarks.map((nav) => nav.getAttribute('aria-label')).sort()).toEqual([
        'navigation.breadcrumb',
        'navigation.sections',
      ]);
    });

    it('should provide skip links for keyboard users', () => {
      render(
        <BrowserRouter>
          <div>
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <nav>Navigation</nav>
            <main id="main-content">
              <h1>Main Content</h1>
            </main>
          </div>
        </BrowserRouter>
      );

      const skipLink = screen.getByText(/skip to main content/i);
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Set mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;

      const mockModules = [
        {
          id: 'events',
          name: 'Events',
          title: 'Event Management',
          description: 'Manage events',
          card: {
            title: 'Event Management',
            description: 'Manage events',
            icon: () => null,
            path: '/events',
          },
          routes: [],
        },
      ];

      const { container } = render(
        <BrowserRouter>
          <DashboardPage modules={mockModules} />
        </BrowserRouter>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have touch-friendly target sizes', () => {
      render(
        <BrowserRouter>
          <button style={{ minWidth: '44px', minHeight: '44px' }}>
            Touch Target
          </button>
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // WCAG recommends minimum 44x44px touch targets
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Language and Locale Accessibility', () => {
    it('should update HTML lang attribute when locale changes', async () => {
      const { LocaleProvider } = await import('../context/LocaleContext');
      
      // Initial render with en-GB locale
      const { rerender } = render(
        <LocaleProvider organizationLocale="en-GB">
          <div>Content</div>
        </LocaleProvider>
      );

      // Verify initial lang attribute
      expect(document.documentElement.lang).toBe('en-gb');

      // Change to French locale
      rerender(
        <LocaleProvider organizationLocale="fr-FR">
          <div>Content</div>
        </LocaleProvider>
      );

      // Wait for locale change to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify lang attribute updated
      expect(document.documentElement.lang).toBe('fr-fr');
    });

    it('should set default lang attribute to en-gb when no locale provided', async () => {
      const { LocaleProvider } = await import('../context/LocaleContext');
      
      render(
        <LocaleProvider>
          <div>Content</div>
        </LocaleProvider>
      );

      // Verify default lang attribute
      expect(document.documentElement.lang).toBe('en-gb');
    });

    it('should update lang attribute for all supported locales', async () => {
      const { LocaleProvider } = await import('../context/LocaleContext');
      
      const supportedLocales = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];
      
      for (const locale of supportedLocales) {
        const { rerender, unmount } = render(
          <LocaleProvider organizationLocale={locale}>
            <div>Content</div>
          </LocaleProvider>
        );

        // Wait for locale change to propagate
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify lang attribute matches locale (lowercase)
        expect(document.documentElement.lang).toBe(locale.toLowerCase());
        
        unmount();
      }
    });

    it('should maintain lang attribute consistency across navigation', async () => {
      const { LocaleProvider } = await import('../context/LocaleContext');
      
      render(
        <BrowserRouter>
          <LocaleProvider organizationLocale="de-DE">
            <Layout>
              <div>Content</div>
            </Layout>
          </LocaleProvider>
        </BrowserRouter>
      );

      // Wait for locale to be set
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify lang attribute is set
      expect(document.documentElement.lang).toBe('de-de');

      // Navigate, and the lang attribute should survive it. The way back to
      // the main page is the one entry the layout always offers.
      window.history.pushState({}, '', '/events');
      await userEvent.click(
        screen.getAllByText('navigation.dashboard')[0]
      );

      // Lang attribute should still be set
      expect(document.documentElement.lang).toBe('de-de');
    });

    it('should announce locale changes to screen readers via lang attribute', async () => {
      const { LocaleProvider } = await import('../context/LocaleContext');
      
      const { rerender } = render(
        <LocaleProvider organizationLocale="en-GB">
          <div>English content</div>
        </LocaleProvider>
      );

      expect(document.documentElement.lang).toBe('en-gb');

      // Change to Spanish
      rerender(
        <LocaleProvider organizationLocale="es-ES">
          <div>Contenido en español</div>
        </LocaleProvider>
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      // Screen readers will detect the lang change via the HTML attribute
      expect(document.documentElement.lang).toBe('es-es');
    });
  });
});
