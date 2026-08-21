import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrganisationGatewayPage from '../OrganisationGatewayPage';
import {
  makeOrganisationContext,
  renderWithProviders,
  TEST_PUBLIC_DETAIL,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

// Partial: `AuthContext` itself must survive, or the shared test
// harness has no provider to render and every page using the session
// throws.
vi.mock('../../context/AuthContext', async () => ({
  ...(await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext')),
  useAuthContext: () => ({ login: mockLogin, register: mockRegister }),
}));

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/**
 * The platform's announcements, which the gateway now shows beside the sign-in
 * card. Defaulted to none, so the tests above this one describe the page as it
 * looks for a deployment that has never written a post — which is the shape
 * they were written against.
 */
let posts: unknown[] = [];
vi.mock('../../hooks/usePlatformPosts', () => ({
  usePlatformPosts: () => ({ posts, loading: false }),
}));

const render = () => renderWithProviders(<OrganisationGatewayPage />);

describe('OrganisationGatewayPage (A2)', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext({ state: 'anonymous', me: null });
    posts = [];
  });

  it('brands the page with the club a visitor arrived for', () => {
    render();
    expect(screen.getByText('Killiney Harbour Paddling Club')).toBeInTheDocument();
  });

  it('returns the visitor to this club after signing in', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // The org code brands Keycloak's own page and is where the visitor lands
    // afterwards. Losing it drops them on the generic directory instead.
    expect(mockLogin).toHaveBeenCalledWith('khpc');
  });

  it('offers registration when the club is accepting members', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(mockRegister).toHaveBeenCalledWith('khpc');
  });

  it('explains a closed club rather than offering a button that fails', () => {
    contextValue = makeOrganisationContext({
      state: 'anonymous',
      me: null,
      publicDetail: { ...TEST_PUBLIC_DETAIL, registrationOpen: false },
    });
    render();

    expect(screen.getByText(/not accepting new registrations/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create an account' })
    ).not.toBeInTheDocument();
  });

  it('offers the directory when the code matches no organisation', async () => {
    const user = userEvent.setup();
    contextValue = makeOrganisationContext({
      state: 'unavailable',
      me: null,
      publicDetail: null,
      publicLoading: false,
    });
    render();

    expect(screen.getByText('We could not find that organisation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse organisations' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('waits rather than claiming the club does not exist', () => {
    // `state` settles to `anonymous` immediately for a signed-out visitor, well
    // before the club's record arrives. Reading that as "not found" would flash
    // an error at every visitor arriving on a club's own link.
    contextValue = makeOrganisationContext({
      state: 'anonymous',
      me: null,
      publicDetail: null,
      publicLoading: true,
    });
    render();

    expect(screen.queryByText('We could not find that organisation')).not.toBeInTheDocument();
  });

  describe('the announcements column', () => {
    const post = (over: Record<string, unknown> = {}) => ({
      id: 'post-1',
      title: 'Planned maintenance',
      body: '<p>We will be unavailable on Sunday.</p>',
      imageUrl: null,
      links: [],
      ...over,
    });

    it('shows the posts the platform has published, in order', () => {
      posts = [post({ id: 'a', title: 'First' }), post({ id: 'b', title: 'Second' })];
      render();

      const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(headings).toEqual(['First', 'Second']);
    });

    it('groups them in a labelled region, so they can be skipped', () => {
      // A landmark is what lets somebody using a screen reader move past the
      // announcements to the sign-in form without hearing all of them.
      posts = [post()];
      render();

      expect(screen.getByRole('region', { name: /announcements/i })).toBeInTheDocument();
    });

    it('renders no region at all when there is nothing to say', () => {
      /*
       * The whole two-column layout collapses back to the original centred
       * card. Without this a deployment that has never written a post gets an
       * empty half of a screen and an off-centre sign-in form.
       */
      render();

      expect(screen.queryByRole('region', { name: /announcements/i })).not.toBeInTheDocument();
    });

    it('keeps the sign-in form regardless', () => {
      // The announcements are decoration; the reason for the page is not.
      posts = [post()];
      render();

      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });
  });
});
