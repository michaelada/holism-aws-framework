import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from '../Layout';
// The app wraps in the shared provider from orgadmin-core, and that is the
// context the page reads — the shell's own copy is a different one.
import { OrganisationProvider } from '@aws-web-framework/orgadmin-core';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { ModuleRegistration } from '../../types/module.types';
import enGB from '../../locales/en-GB/translation.json';
/*
 * Resolve keys against the real en-GB strings, so the assertions below read as
 * what an administrator sees rather than as dotted key paths.
 */
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = key
        .split('.')
        .reduce<any>((node, part) => (node == null ? undefined : node[part]), enGB);
      if (typeof value !== 'string') return key;
      return value.replace(/{{(\w+)}}/g, (_match, name) =>
        String(options?.[name] ?? `{{${name}}}`)
      );
    },
    i18n: { language: 'en-GB', changeLanguage: vi.fn() },
  }),
}));

import { Dashboard as DashboardIcon, Event as EventIcon } from '@mui/icons-material';

// Mock organisation data
const mockOrganisation = {
  id: 'org-1',
  organizationTypeId: 'type-1',
  keycloakGroupId: 'group-1',
  name: 'test-org',
  displayName: 'Test Organisation',
  status: 'active' as const,
  enabledCapabilities: ['event-management'],
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock modules
const mockModules: ModuleRegistration[] = [
  {
    id: 'events',
    name: 'Events',
    title: 'Event Management',
    description: 'Manage events',
    capability: 'event-management',
    order: 1,
    card: {
      title: 'Event Management',
      description: 'Manage events',
      icon: EventIcon,
      path: '/events',
    },
    // The drawer shows the current module's items, and the current module is
    // matched on its registered routes.
    routes: [{ path: 'events', element: null as never }],
    menuItem: {
      label: 'Events',
      path: '/events',
      icon: EventIcon,
    },
  },
];

const renderLayout = (modules: ModuleRegistration[] = [], onLogout = vi.fn()) => {
  /*
   * Away from the landing page: on `/` the layout deliberately shows no
   * navigation and no logout, because that page is the menu.
   */
  window.history.pushState({}, '', '/events');

  return render(
    <BrowserRouter>
      <OrganisationProvider organisation={mockOrganisation}>
        <OnboardingProvider>
          <Layout modules={modules} onLogout={onLogout}>
            <div>Test Content</div>
          </Layout>
        </OnboardingProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};

describe('Layout Component', () => {
  it('should render the layout with ItsPlainSailing branding', () => {
    renderLayout();
    
    // Check for ItsPlainSailing branding in AppBar
    const brandingElements = screen.getAllByText('ItsPlainSailing');
    expect(brandingElements.length).toBeGreaterThan(0);
  });

  it('should display organisation name', () => {
    renderLayout();
    
    // Organisation name should appear in the drawer (multiple times due to mobile/desktop drawers)
    const orgNames = screen.getAllByText('Test Organisation');
    expect(orgNames.length).toBeGreaterThan(0);
  });

  it('should render navigation menu with a link back to the main page', () => {
    renderLayout();
    
    // The way back to the main page is the entry the drawer always offers
    // (twice over — the mobile and desktop drawers are both mounted).
    const homeLinks = screen.getAllByText('Back to Main Page');
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it('should render module menu items', () => {
    renderLayout(mockModules);
    
    // Module menu item should be rendered (multiple times due to mobile/desktop drawers)
    const eventLinks = screen.getAllByText('Events');
    expect(eventLinks.length).toBeGreaterThan(0);
  });

  it('should render logout button', () => {
    renderLayout();
    
    // Logout button should be present (multiple times due to mobile/desktop drawers)
    const logoutButtons = screen.getAllByText('Logout');
    expect(logoutButtons.length).toBeGreaterThan(0);
  });

  it('should call onLogout when logout button is clicked', () => {
    const onLogout = vi.fn();
    renderLayout([], onLogout);
    
    // Click logout button (get first one from mobile/desktop drawers)
    const logoutButtons = screen.getAllByText('Logout');
    fireEvent.click(logoutButtons[0]);
    
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('should render children content', () => {
    renderLayout();
    
    // Children should be rendered in main content area
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should not render menu items for modules without menuItem', () => {
    const modulesWithoutMenuItem: ModuleRegistration[] = [
      {
        id: 'test',
        name: 'Test',
        title: 'Test Module',
        description: 'Test',
        order: 1,
        card: {
          title: 'Test',
          description: 'Test',
          icon: DashboardIcon,
          path: '/test',
        },
        routes: [],
        // No menuItem
      },
    ];
    
    renderLayout(modulesWithoutMenuItem);
    
    // Should only have Dashboard, not the test module
    const menuItems = screen.queryByText('Test Module');
    expect(menuItems).not.toBeInTheDocument();
  });
});
