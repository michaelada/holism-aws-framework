import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell from '../AppShell';
import {
  makeOrganisationContext,
  renderWithProviders,
  TEST_ME,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { setViewportWidth } from '../../test/setup';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

vi.mock('../../context/AuthContext', () => ({
  useAuthContext: () => ({ logout: mockLogout }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const withCapabilities = (capabilities: string[]) =>
  makeOrganisationContext({
    capabilities,
    me: { ...TEST_ME, organisation: { ...TEST_ME.organisation, capabilities } },
  });

const render = () =>
  renderWithProviders(
    <AppShell>
      <div>Page content</div>
    </AppShell>
  );

describe('AppShell (B1/B2)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockReset();
    contextValue = makeOrganisationContext();
  });

  it('renders the page it wraps', () => {
    render();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('names the organisation the member is in', () => {
    render();
    // The brief asks that it always be clear which club is being used; the name
    // in the header is that affordance, and it doubles as the switcher trigger.
    expect(
      screen.getAllByText('Killiney Harbour Paddling Club').length
    ).toBeGreaterThan(0);
  });

  it('opens the switcher from the organisation name', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: /switch organisation/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/switch');
  });

  it('shows only the areas the club has enabled', () => {
    contextValue = withCapabilities(['memberships']);
    render();

    expect(screen.getByRole('link', { name: 'My memberships' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Events' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Shop' })).not.toBeInTheDocument();
  });

  it('hides a section heading once nothing in it survives the gate', () => {
    contextValue = withCapabilities([]);
    render();

    expect(screen.queryByText('My activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Browse')).not.toBeInTheDocument();
  });

  it('always leaves a member somewhere to land and a way to their own details', () => {
    contextValue = withCapabilities([]);
    render();

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile & settings' })).toBeInTheDocument();
  });

  it('points every link at the organisation in the URL', () => {
    contextValue = withCapabilities(['memberships']);
    render();

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/khpc');
    expect(screen.getByRole('link', { name: 'My memberships' })).toHaveAttribute(
      'href',
      '/khpc/memberships'
    );
  });

  it('signs the member out on request', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('exposes the navigation to assistive technology', () => {
    render();
    expect(screen.getByRole('navigation', { name: 'Menu' })).toBeInTheDocument();
  });

  /**
   * B2 — the same shell on a phone. The brief requires the app be responsive,
   * and the navigation moving behind a button is the whole of that difference,
   * so it is worth pinning rather than trusting the breakpoint prop.
   */
  describe('on a phone', () => {
    beforeEach(() => setViewportWidth(400));

    it('hides the navigation behind a menu button', () => {
      render();

      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
      // The drawer stays mounted for instant reopening, so it is present but
      // must not be exposed while closed.
      expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
    });

    it('opens the navigation when the menu button is used', async () => {
      const user = userEvent.setup();
      render();

      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getByRole('navigation', { name: 'Menu' })).toBeInTheDocument();
    });

    /**
     * The slide-out overlays the page, so a see-through panel leaves the page
     * text running behind the menu items. Pinned because nothing else in the
     * suite would notice: on a desktop the drawer sits beside the content, so
     * a transparent panel looks perfectly fine there.
     */
    it('draws the slide-out on an opaque panel', async () => {
      const user = userEvent.setup();
      render();

      await user.click(screen.getByRole('button', { name: 'Menu' }));

      const paper = document.querySelector('.MuiDrawer-paper') as HTMLElement;
      const background = getComputedStyle(paper).backgroundColor;
      expect(background).not.toBe('');
      expect(background).not.toBe('transparent');
      expect(background).not.toMatch(/rgba\([^)]*,\s*0(\.0+)?\)/);
    });

    it('gates the menu by capability just as the desktop layout does', async () => {
      const user = userEvent.setup();
      contextValue = withCapabilities(['memberships']);
      render();

      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getByRole('link', { name: 'My memberships' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Events' })).not.toBeInTheDocument();
    });
  });

  it('shows no menu button on a desktop, where the drawer is always present', () => {
    render();
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
