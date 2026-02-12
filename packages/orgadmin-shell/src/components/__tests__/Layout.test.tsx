import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from '../Layout';
import { OrganisationProvider } from '../../context/OrganisationContext';
import { ModuleRegistration } from '../../types/module.types';
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
    routes: [],
    menuItem: {
      label: 'Events',
      path: '/events',
      icon: EventIcon,
    },
  },
];

const renderLayout = (modules: ModuleRegistration[] = [], onLogout = vi.fn()) => {
  return render(
    <BrowserRouter>
      <OrganisationProvider organisation={mockOrganisation}>
        <Layout modules={modules} onLogout={onLogout}>
          <div>Test Content</div>
        </Layout>
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

  it('should render navigation menu with Dashboard link', () => {
    renderLayout();
    
    // Dashboard link should always be present (multiple times due to mobile/desktop drawers)
    const dashboardLinks = screen.getAllByText('Dashboard');
    expect(dashboardLinks.length).toBeGreaterThan(0);
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
