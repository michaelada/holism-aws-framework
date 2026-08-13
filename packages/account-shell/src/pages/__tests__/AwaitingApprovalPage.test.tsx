import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AwaitingApprovalPage from '../AwaitingApprovalPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();

/**
 * Held in a mutable box and read fresh on each call so a test can set the state
 * before rendering. Returning the same object identity matters — the page keys
 * effects on `refresh` (CLAUDE.md §3.4).
 */
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
  renderWithProviders(<AwaitingApprovalPage />, {
    route: '/khpc/pending',
    path: '/:orgCode/pending',
  });

describe('AwaitingApprovalPage (A8)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    mockExecute.mockResolvedValue({ organisations: [] });
    contextValue = makeOrganisationContext({ state: 'pending' });
  });

  it('shows both gates so the member can see which one they are behind', async () => {
    render();

    expect(await screen.findByText('Awaiting approval')).toBeInTheDocument();
    // The email gate is passed and the approval gate is not. Showing only one
    // is what leaves a member unable to understand why they are locked out.
    expect(screen.getByText('Email address verified')).toBeInTheDocument();
    expect(screen.getByText('Awaiting club approval')).toBeInTheDocument();
  });

  it('re-checks without a page reload when asked', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue('pending');
    contextValue = makeOrganisationContext({ state: 'pending', refresh });

    render();
    await user.click(screen.getByRole('button', { name: /check again/i }));

    expect(refresh).toHaveBeenCalled();
  });

  it('says so when a re-check finds the request still pending', async () => {
    const user = userEvent.setup();
    contextValue = makeOrganisationContext({
      state: 'pending',
      refresh: vi.fn().mockResolvedValue('pending'),
    });

    render();
    await user.click(screen.getByRole('button', { name: /check again/i }));

    expect(await screen.findByText('Still awaiting approval.')).toBeInTheDocument();
  });

  it('does not claim "still pending" when the re-check found approval', async () => {
    const user = userEvent.setup();
    contextValue = makeOrganisationContext({
      state: 'pending',
      // Approval granted between renders — the outcome comes from what refresh
      // returns, not from the stale `state` in the click handler's closure.
      refresh: vi.fn().mockResolvedValue('connected'),
    });

    render();
    await user.click(screen.getByRole('button', { name: /check again/i }));

    await waitFor(() =>
      expect(screen.queryByText('Still awaiting approval.')).not.toBeInTheDocument()
    );
  });

  it('shows the rejection wording, and no way to re-check', async () => {
    contextValue = makeOrganisationContext({ state: 'rejected' });
    render();

    expect(await screen.findByText('Request not approved')).toBeInTheDocument();
    // Re-checking a decision the club has already made would only invite
    // repeated polling of an answer that will not change.
    expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument();
  });

  it('gives no reason for a rejection', async () => {
    contextValue = makeOrganisationContext({ state: 'rejected' });
    render();

    // Whatever the admin recorded is internal — surfacing it invites arguments
    // the platform cannot adjudicate.
    const body = await screen.findByText(/did not approve your request/i);
    expect(body.textContent).not.toMatch(/reason/i);
  });

  it('shows the inactive wording for a deactivated account', async () => {
    contextValue = makeOrganisationContext({ state: 'inactive' });
    render();

    expect(await screen.findByText('Your account is inactive')).toBeInTheDocument();
  });

  it('offers a way out to a member who belongs to another club', async () => {
    mockExecute.mockResolvedValue({ organisations: [
      {
        organisationId: 'org-2',
        organisationUserId: 'ou-2',
        urlCode: 'asc',
        displayName: 'Athlone Swimming Club',
        currency: 'EUR',
        language: 'en',
        capabilities: [],
        status: 'active',
      },
    ] });

    render();

    // Without this strip a multi-org member is stranded behind one club's
    // approval queue with no route to a club they already belong to.
    expect(await screen.findByText('Athlone Swimming Club')).toBeInTheDocument();
  });

  it('omits the strip when there is nowhere else to go', async () => {
    render();

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    expect(screen.queryByText(/meanwhile, you can go to/i)).not.toBeInTheDocument();
  });

  it('does not offer the club the member is already waiting on', async () => {
    mockExecute.mockResolvedValue({ organisations: [
      {
        organisationId: 'org-1',
        organisationUserId: 'ou-1',
        urlCode: 'khpc',
        displayName: 'Killiney Harbour Paddling Club',
        currency: 'EUR',
        language: 'en',
        capabilities: [],
        status: 'pending',
      },
    ] });

    render();

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    expect(screen.queryByText(/meanwhile, you can go to/i)).not.toBeInTheDocument();
  });
});
