import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
import { OrganisationProvider } from '../../context/OrganisationContext';
import { CapabilityProvider } from '../../context/CapabilityContext';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { ModuleRegistration } from '../../types/module.types';
import { Event as EventIcon, People as PeopleIcon, Settings as SettingsIcon } from '@mui/icons-material';

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
    order: 2,
    card: {
      title: 'Event Management',
      description: 'Manage events',
      icon: EventIcon,
      path: '/events',
    },
    routes: [],
  },
  {
    id: 'members',
    name: 'Members',
    title: 'Membership Management',
    description: 'Manage members',
    capability: 'memberships',
    order: 3,
    card: {
      title: 'Membership Management',
      description: 'Manage members',
      icon: PeopleIcon,
      path: '/members',
    },
    routes: [],
  },
  {
    id: 'settings',
    name: 'Settings',
    title: 'Settings',
    description: 'Configure settings',
    // No capability - core module
    order: 1,
    card: {
      title: 'Settings',
      description: 'Configure settings',
      icon: SettingsIcon,
      path: '/settings',
    },
    routes: [],
  },
];

const renderDashboardPage = (
  modules: ModuleRegistration[] = mockModules,
  capabilities: string[] = ['event-management']
) => {
  return render(
    <BrowserRouter>
      <OrganisationProvider organisation={mockOrganisation}>
        <CapabilityProvider capabilities={capabilities}>
          <OnboardingProvider>
            <DashboardPage modules={modules} />
          </OnboardingProvider>
        </CapabilityProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};

describe('DashboardPage Component', () => {
  it('should display welcome message with organisation name', () => {
    renderDashboardPage();
    
    expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
  });

  it('should display instruction text', () => {
    renderDashboardPage();
    
    expect(screen.getByText(/Select an area below to get started/i)).toBeInTheDocument();
  });

  it('should filter modules based on capabilities', () => {
    renderDashboardPage(mockModules, ['event-management']);
    
    // Should show Events (has capability) and Settings (core module)
    expect(screen.getByText('Event Management')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    
    // Should NOT show Members (capability not enabled)
    expect(screen.queryByText('Membership Management')).not.toBeInTheDocument();
  });

  it('should show all modules when all capabilities are enabled', () => {
    renderDashboardPage(mockModules, ['event-management', 'memberships']);
    
    // All modules should be visible
    expect(screen.getByText('Event Management')).toBeInTheDocument();
    expect(screen.getByText('Membership Management')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should always show core modules regardless of capabilities', () => {
    renderDashboardPage(mockModules, []); // No capabilities
    
    // Core module (Settings) should still be visible
    expect(screen.getByText('Settings')).toBeInTheDocument();
    
    // Capability modules should not be visible
    expect(screen.queryByText('Event Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Membership Management')).not.toBeInTheDocument();
  });

  it('should sort modules by order', () => {
    renderDashboardPage(mockModules, ['event-management', 'memberships']);
    
    // Get all card titles
    const cards = screen.getAllByRole('heading', { level: 6 });
    const titles = cards.map(card => card.textContent);
    
    // Settings (order: 1) should come before Events (order: 2) and Members (order: 3)
    expect(titles.indexOf('Settings')).toBeLessThan(titles.indexOf('Event Management'));
    expect(titles.indexOf('Event Management')).toBeLessThan(titles.indexOf('Membership Management'));
  });

  it('should display message when no modules are available', () => {
    renderDashboardPage([], []);
    
    expect(screen.getByText('No modules available')).toBeInTheDocument();
    expect(screen.getByText(/Contact your administrator/i)).toBeInTheDocument();
  });

  it('should use module.title and module.description from registrations', () => {
    const customModule: ModuleRegistration = {
      id: 'custom',
      name: 'Custom',
      title: 'Custom Title',
      description: 'Custom Description',
      order: 1,
      card: {
        title: 'Custom Title',
        description: 'Custom Description',
        icon: SettingsIcon,
        path: '/custom',
      },
      routes: [],
    };
    
    renderDashboardPage([customModule], []);
    
    // Should use the title and description from the module registration
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
  });
});
