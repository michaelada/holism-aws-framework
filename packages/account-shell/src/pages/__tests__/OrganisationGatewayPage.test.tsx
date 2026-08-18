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

const render = () => renderWithProviders(<OrganisationGatewayPage />);

describe('OrganisationGatewayPage (A2)', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext({ state: 'anonymous', me: null });
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
});
