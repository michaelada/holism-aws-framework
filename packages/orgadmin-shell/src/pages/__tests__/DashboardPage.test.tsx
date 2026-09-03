import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
// The app wraps in the shared provider from orgadmin-core, and that is the
// context the page reads — the shell's own copy is a different one.
import { OrganisationProvider } from '@itsplainsailing/orgadmin-core';
import { CapabilityProvider } from '../../context/CapabilityContext';
import { ModuleRegistration } from '../../types/module.types';
import enGB from '../../locales/en-GB/translation.json';
/*
 * Resolve keys against the real en-GB strings, so the assertions below read as
 * what an administrator sees rather than as dotted key paths.
 */
/*
 * Onboarding is stubbed rather than provided: with no auth token the real
 * provider falls back to "welcome not yet dismissed" and opens its dialog,
 * whose modal marks the page behind it aria-hidden — the cards under test then
 * cannot be found by role at all.
 */
vi.mock('../../context/OnboardingContext', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../context/OnboardingContext');
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
          <DashboardPage modules={modules} />
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

  /**
   * The dashboard lays the cards out in a fixed, product-decided order by
   * module id — what a club does day to day first, settings last — and only
   * falls back to a module's own `order` for ids it does not know about.
   */
  it('should lay modules out in the dashboard order', () => {
    renderDashboardPage(mockModules, ['event-management', 'memberships']);
    
    // Card titles are level-5 headings: the page title above them is an h4,
    // and skipping a level reads as a missing one to a screen reader.
    const cards = screen.getAllByRole('heading', { level: 5 });
    const titles = cards.map(card => card.textContent);
    
    expect(titles).toEqual([
      'Event Management',
      'Membership Management',
      'Settings',
    ]);
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
