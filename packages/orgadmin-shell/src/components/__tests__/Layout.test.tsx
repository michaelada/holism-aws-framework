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

/** A capability module with sub-items, one of them capability-gated. */
const eventsWithSubItems: ModuleRegistration = {
  ...mockModules[0],
  subMenuItems: [
    { label: 'All Events', path: '/events' },
    { label: 'Event Types', path: '/events/types', capability: 'event-types' },
  ],
};

/** A core area: `capability: undefined` is the registry's marker for always-on. */
const settingsModule: ModuleRegistration = {
  id: 'settings',
  name: 'Settings',
  title: 'Settings',
  description: 'Configure the organisation',
  order: 1,
  card: { title: 'Settings', description: 'Configure', icon: DashboardIcon, path: '/settings' },
  routes: [{ path: 'settings', element: null as never }],
  menuItem: { label: 'Settings', path: '/settings', icon: DashboardIcon },
};

/**
 * Core areas that still belong under "running the organisation".
 *
 * Payments and Reporting carry no capability — every organisation has them —
 * but neither is setup: you do not configure payments once and walk away, you
 * go and look at what came in.
 */
const paymentsModule: ModuleRegistration = {
  id: 'payments',
  name: 'Payments',
  title: 'Payments',
  description: 'What came in',
  order: 2,
  card: { title: 'Payments', description: 'Payments', icon: DashboardIcon, path: '/payments' },
  routes: [{ path: 'payments', element: null as never }],
  menuItem: { label: 'Payments', path: '/payments', icon: DashboardIcon },
};

const reportingModule: ModuleRegistration = {
  ...paymentsModule,
  id: 'reporting',
  name: 'Reporting',
  title: 'Reporting',
  order: 3,
  card: { title: 'Reporting', description: 'Reporting', icon: DashboardIcon, path: '/reporting' },
  routes: [{ path: 'reporting', element: null as never }],
  menuItem: { label: 'Reporting', path: '/reporting', icon: DashboardIcon },
};

const renderAt = (path: string, modules: ModuleRegistration[]) => {
  window.history.pushState({}, '', path);
  return render(
    <BrowserRouter>
      <OrganisationProvider organisation={mockOrganisation}>
        <OnboardingProvider>
          <Layout modules={modules}><div>Test Content</div></Layout>
        </OnboardingProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};

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
  it('offers the dashboard as a destination, not a way back', () => {
    renderLayout();

    /*
     * This entry used to read "Back to Main Page", which only made sense while
     * the dashboard was the menu and the rail was suppressed there. The rail is
     * now global, so the dashboard is one destination among many.
     */
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.queryByText('Back to Main Page')).not.toBeInTheDocument();
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

  /*
   * The rail used to be suppressed on `/`, so the screen every administrator
   * starts from was the only one with no navigation — crossing from one module
   * to another meant returning here and re-scanning the cards.
   */
  it('keeps the navigation rail on the dashboard', () => {
    renderAt('/', [eventsWithSubItems, settingsModule]);

    expect(screen.getAllByText('Events').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('groups the organisation’s work above its setup', () => {
    renderAt('/events', [eventsWithSubItems, settingsModule]);

    /*
     * `hidden: true` because both drawers are mounted at once and jsdom applies
     * no media queries, so neither is in the accessibility tree here. The
     * headings are real `<h2>`s in the browser; this only reflects the harness.
     */
    const headings = screen
      .getAllByRole('heading', { level: 2, hidden: true })
      .map((h) => h.textContent);
    const work = headings.indexOf('Running the Org');
    const setup = headings.indexOf('Setup');

    expect(work).toBeGreaterThanOrEqual(0);
    expect(setup).toBeGreaterThan(work);
  });

it('puts Payments and Reporting under running, not setup', () => {
    /*
     * They are ungated, so the plain capability split filed them under Setup
     * next to Forms — which is where you look to configure something, not to
     * see what money came in this week.
     */
    renderAt('/payments', [eventsWithSubItems, paymentsModule, reportingModule, settingsModule]);

    const headings = screen
      .getAllByRole('heading', { level: 2, hidden: true })
      .map((h) => h.textContent);
    const work = headings.indexOf('Running the Org');
    const setup = headings.indexOf('Setup');

    /*
     * Position by document order within the rail.
     *
     * Scoped to a `<nav>`, because this test renders at `/payments` and the page
     * header says "Payments" before the rail does — a whole-document search
     * compares a heading against a menu item. And to the *right* nav: the
     * breadcrumb is one too, and it comes first.
     */
    const rail =
      Array.from(document.querySelectorAll('nav'))
        .map((nav) => nav.textContent ?? '')
        .find((text) => text.includes('Running the Org')) ?? '';
    const positionOf = (label: string) => rail.indexOf(label);

    expect(rail).not.toBe('');
    expect(work).toBeGreaterThanOrEqual(0);
    expect(setup).toBeGreaterThan(work);
    // Both appear, and Settings is still the one under Setup.
    expect(screen.getAllByText('Payments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reporting').length).toBeGreaterThan(0);
    expect(positionOf('Payments')).toBeLessThan(positionOf('Settings'));
    expect(positionOf('Reporting')).toBeLessThan(positionOf('Settings'));

    /*
     * And after the capability modules. On `order` alone they would lead the
     * section — the core areas were numbered 1–9 when they all sat in Setup —
     * with Events beneath them, which reads as an accident.
     */
    expect(positionOf('Events')).toBeLessThan(positionOf('Payments'));
  });

  it('shows the running group for an organisation with no capability modules', () => {
    // Payments alone is enough to earn the heading — it is not a setup area.
    renderAt('/payments', [paymentsModule, settingsModule]);

    expect(screen.getAllByText('Running the Org').length).toBeGreaterThan(0);
  });

  it('renders no heading for a group with nothing in it', () => {
    // Only setup areas — no capability module, and none of the core areas
    // that count as running the organisation.
    renderAt('/settings', [settingsModule]);

    expect(screen.queryByText('Running the Org')).not.toBeInTheDocument();
    expect(screen.getAllByText('Setup').length).toBeGreaterThan(0);
  });

  it('expands only the module you are in', () => {
    const inEvents = renderAt('/events', [eventsWithSubItems, settingsModule]);
    expect(screen.getAllByText('All Events').length).toBeGreaterThan(0);
    inEvents.unmount();

    /*
     * From another module the same sub-items are gone. Expansion follows the
     * route, so there is no toggle state to get out of step with the URL.
     */
    renderAt('/settings', [eventsWithSubItems, settingsModule]);
    expect(screen.getAllByText('Events').length).toBeGreaterThan(0);
    expect(screen.queryByText('All Events')).not.toBeInTheDocument();
  });

  it('hides a sub-item the organisation has no capability for', () => {
    // `mockOrganisation` enables `event-management` but not `event-types`.
    renderAt('/events', [eventsWithSubItems]);

    expect(screen.getAllByText('All Events').length).toBeGreaterThan(0);
    expect(screen.queryByText('Event Types')).not.toBeInTheDocument();
  });

  it('says where you are, from the organisation down', () => {
    renderAt('/events/types', [eventsWithSubItems]);

    const trail = screen.getByLabelText('Breadcrumb');
    expect(trail).toHaveTextContent('Test Organisation');
    expect(trail).toHaveTextContent('Events');
  });

  /*
   * The old comparator read `(a.order || 999) - (b.order || 99)`: the two
   * defaults disagreed by a factor of ten, so a module with no `order` sorted
   * ahead of every module that had one.
   */
  it('sorts a module with no explicit order last, not first', () => {
    const unordered: ModuleRegistration = {
      ...settingsModule,
      id: 'later',
      name: 'Later',
      order: undefined,
      menuItem: { label: 'Later', path: '/later', icon: DashboardIcon },
    };
    const ordered: ModuleRegistration = {
      ...settingsModule,
      id: 'first',
      name: 'First',
      order: 1,
      menuItem: { label: 'First', path: '/first', icon: DashboardIcon },
    };
    renderAt('/settings', [unordered, ordered]);

    const items = screen.getAllByRole('button', { hidden: true }).map((b) => b.textContent ?? '');
    const firstIdx = items.findIndex((text) => text.includes('First'));
    const laterIdx = items.findIndex((text) => text.includes('Later'));

    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(laterIdx).toBeGreaterThan(firstIdx);
  });
});
