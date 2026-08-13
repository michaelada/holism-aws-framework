import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterWithOrganisationPage from '../RegisterWithOrganisationPage';
import {
  makeOrganisationContext,
  renderWithProviders,
  TEST_PUBLIC_DETAIL,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

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

const render = () =>
  renderWithProviders(<RegisterWithOrganisationPage />, {
    route: '/khpc/register',
    path: '/:orgCode/register',
  });

/** Answer the public lookup, then the registration POST. */
const respondWith = (outcome: 'active' | 'pending') => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) =>
    request.method === 'POST'
      ? Promise.resolve({ outcome, organisationUserId: 'ou-1' })
      : Promise.resolve(TEST_PUBLIC_DETAIL)
  );
};

describe('RegisterWithOrganisationPage (A4)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext({ state: 'not-connected', me: null });
    respondWith('active');
  });

  it('says what connecting actually does', async () => {
    render();

    expect(
      await screen.findByText(/connects your ItsPlainSailing account/i)
    ).toBeInTheDocument();
  });

  /**
   * Members otherwise believe they have joined and paid, and only discover
   * otherwise when they cannot enter anything.
   */
  it('is clear that connecting is not the same as buying a membership', async () => {
    render();

    expect(await screen.findByText(/does not buy a membership/i)).toBeInTheDocument();
  });

  it('connects the member to the club', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', url: '/api/account/khpc/register' })
      )
    );
  });

  it('confirms immediate access when the club auto-approves', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));

    expect(await screen.findByText('Request sent')).toBeInTheDocument();
    expect(
      screen.getByText(/now connected to Killiney Harbour Paddling Club/i)
    ).toBeInTheDocument();
  });

  it('warns of the approval gate when the club reviews registrations', async () => {
    const user = userEvent.setup();
    respondWith('pending');
    render();

    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));

    // The outcome is the club's setting, not the member's choice, so it can
    // only be read from the response — predicting it before submitting would be
    // wrong for exactly the clubs that gate registration.
    expect(await screen.findByText(/will review your request/i)).toBeInTheDocument();
  });

  it('sends an approved member into the club and a pending one to the wait screen', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc');
  });

  it('routes a pending registration to the awaiting-approval screen', async () => {
    const user = userEvent.setup();
    respondWith('pending');
    render();

    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc/pending');
  });

  it('re-resolves the organisation so the member is not left looking disconnected', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue('connected');
    contextValue = makeOrganisationContext({ state: 'not-connected', me: null, refresh });
    respondWith('active');

    render();
    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('reports a failed registration and leaves the member able to retry', async () => {
    const user = userEvent.setup();
    mockExecute.mockImplementation((request: { method?: string }) =>
      request.method === 'POST'
        ? Promise.reject(new Error('nope'))
        : Promise.resolve(TEST_PUBLIC_DETAIL)
    );

    render();
    await user.click(await screen.findByRole('button', { name: 'Connect to this organisation/ club' }));

    expect(await screen.findByText(/could not connect you to this club/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect to this organisation/ club' })).toBeEnabled();
  });
});
