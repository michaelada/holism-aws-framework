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

    expect(await screen.findByText(/is not a membership/i)).toBeInTheDocument();
  });

  it('connects the member to the club', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', url: '/api/account/khpc/register' })
      )
    );
  });

  /*
   * Straight into the club rather than onto a confirmation screen.
   *
   * The old "Request sent" panel could not survive the refresh it depended on:
   * re-resolving puts the shell briefly into `loading`, `OrganisationRoute`
   * swaps this screen for a spinner, and the page remounts with its state
   * reset — leaving the member back on the join form with no sign that
   * anything had happened.
   */
  it('sends an approved member into the club’s home page', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/khpc', { replace: true })
    );
  });

  it('routes a pending registration to the awaiting-approval screen', async () => {
    // The outcome is the club's setting, not the member's choice, so it can
    // only be read from the response — predicting it before submitting would be
    // wrong for exactly the clubs that gate registration.
    const user = userEvent.setup();
    respondWith('pending');
    render();

    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/khpc/pending', { replace: true })
    );
  });

  it('replaces the join form in history, so Back does not return to it', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    const [, options] = mockNavigate.mock.calls.at(-1)!;
    expect(options).toEqual({ replace: true });
  });

  it('still arrives in the club when re-resolving the shell fails', async () => {
    // The member is already joined by that point; a failed re-read is not a
    // failed join, and reporting it as one would say it had not worked.
    const user = userEvent.setup();
    contextValue = makeOrganisationContext({
      state: 'not-connected',
      me: null,
      refresh: vi.fn().mockRejectedValue(new Error('resolve failed')),
    });
    respondWith('active');
    render();

    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/khpc', { replace: true })
    );
  });

  it('re-resolves the organisation so the member is not left looking disconnected', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue('connected');
    contextValue = makeOrganisationContext({ state: 'not-connected', me: null, refresh });
    respondWith('active');

    render();
    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

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
    await user.click(await screen.findByRole('button', { name: 'Create my account' }));

    expect(await screen.findByText(/could not create your account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my account' })).toBeEnabled();
  });
});
