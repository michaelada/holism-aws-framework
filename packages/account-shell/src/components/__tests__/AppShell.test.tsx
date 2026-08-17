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
import { notifyCartChanged } from '../../cart/cartActivity';

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

/*
 * The shell reads the basket to size its badge. Answered here so every existing
 * case renders as it did, and overridden per-case below.
 */
const mockExecute = vi.fn().mockResolvedValue({ items: [] });

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

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


/**
 * How full the basket is, beside the word Basket.
 *
 * The count has to survive being changed from anywhere — a slot from the
 * calendar, a size from the shop — so it listens for cart writes rather than
 * being handed a refresh by each screen.
 */
describe('AppShell — the basket count', () => {
  const cart = (lines: number, over: Record<string, unknown>[] = []) => ({
    items: [
      ...Array.from({ length: lines }, (_, i) => ({ id: `item-${i}`, expired: false })),
      ...over,
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue({ items: [] });
  });

  it('shows nothing at all when the basket is empty', async () => {
    // A badge reading "0" is a permanent fixture that stops meaning anything,
    // and there is nothing for the member to go and look at.
    render();

    expect(await screen.findByText('Basket')).toBeInTheDocument();
    expect(screen.queryByLabelText(/in your basket/i)).not.toBeInTheDocument();
  });

  it('counts the lines in the basket', async () => {
    mockExecute.mockResolvedValue(cart(3));
    render();

    expect(await screen.findByLabelText('3 items in your basket')).toBeInTheDocument();
  });

  it('counts lines, not quantities', async () => {
    // Three of one jumper is one thing to come back to; a badge reading "3"
    // would send the member to check.
    mockExecute.mockResolvedValue({ items: [{ id: 'item-1', quantity: 3, expired: false }] });
    render();

    expect(await screen.findByLabelText('1 item in your basket')).toBeInTheDocument();
  });

  it('leaves out a line whose hold has lapsed', async () => {
    // Checkout refuses the basket while one is present, so counting it would
    // advertise an item the member cannot buy.
    mockExecute.mockResolvedValue(cart(2, [{ id: 'gone', expired: true }]));
    render();

    expect(await screen.findByLabelText('2 items in your basket')).toBeInTheDocument();
  });

  it('announces the count as a phrase, not a bare number', async () => {
    mockExecute.mockResolvedValue(cart(1));
    render();

    const badge = await screen.findByLabelText('1 item in your basket');
    // The digits themselves are hidden, or a screen reader reads them twice.
    expect(badge.querySelector('[aria-hidden]')).toHaveTextContent('1');
  });

  it('says nothing when the basket cannot be read', async () => {
    // Decoration on a menu: an offline member should not be shown an error
    // about a number they did not ask for.
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    expect(await screen.findByText('Basket')).toBeInTheDocument();
    expect(screen.queryByLabelText(/in your basket/i)).not.toBeInTheDocument();
  });

  it('re-reads the basket when something writes to it', async () => {
    mockExecute.mockResolvedValue(cart(1));
    render();
    await screen.findByLabelText('1 item in your basket');

    // What a page adding a slot causes, without knowing the badge exists.
    mockExecute.mockResolvedValue(cart(2));
    notifyCartChanged();

    expect(await screen.findByLabelText('2 items in your basket')).toBeInTheDocument();
  });
});
