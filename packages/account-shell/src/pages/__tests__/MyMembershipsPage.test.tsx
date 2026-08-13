import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyMembershipsPage from '../MyMembershipsPage';
import {
  makeOrganisationContext,
  renderWithProviders,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountMembershipRecord } from '../../types/account';

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

const membership = (over: Partial<AccountMembershipRecord> = {}): AccountMembershipRecord => ({
  id: 'member-1',
  membershipNumber: 'M-0001',
  membershipTypeId: 'mt-1',
  membershipTypeName: 'Full Member',
  status: 'active',
  validUntil: '2026-12-31',
  dateLastRenewed: '2026-01-01',
  paymentStatus: 'paid',
  daysRemaining: 200,
  canRenew: false,
  renewalNotOpen: false,
  ...over,
});

const render = () =>
  renderWithProviders(<MyMembershipsPage />, {
    route: '/khpc/memberships',
    path: '/:orgCode/memberships',
  });

describe('MyMembershipsPage (C4)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([membership()]);
  });

  it('shows the membership with its type and number', async () => {
    render();

    expect(await screen.findByText('Full Member')).toBeInTheDocument();
    expect(screen.getByText(/M-0001/)).toBeInTheDocument();
  });

  it('does not count down a membership with months left to run', async () => {
    render();

    await waitFor(() => expect(screen.getByText('Full Member')).toBeInTheDocument());
    // A countdown at 200 days is noise, not information.
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
  });

  it('counts down once the membership is close to expiring', async () => {
    mockExecute.mockResolvedValue([membership({ daysRemaining: 12, canRenew: true })]);
    render();

    expect(await screen.findByText('Expires in 12 days')).toBeInTheDocument();
  });

  it('says a lapsed membership has expired rather than counting backwards', async () => {
    // A naive countdown would render "Expires in -6 days".
    mockExecute.mockResolvedValue([membership({ daysRemaining: -6, canRenew: true })]);
    render();

    expect(await screen.findByText('Expired 6 days ago')).toBeInTheDocument();
    expect(screen.queryByText(/-6/)).not.toBeInTheDocument();
  });

  /**
   * Renewal happens in the membership catalogue, which now offers a type the
   * member holds and is within 30 days of losing rather than refusing it as
   * `already-a-member`. This used to point at `/join`, a route that never
   * existed — the button worked and led to the catch-all redirect.
   */
  it('sends a renewing member to the membership catalogue', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue([membership({ daysRemaining: 12, canRenew: true })]);
    render();

    await user.click(await screen.findByRole('button', { name: 'Renew' }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/browse/memberships');
  });

  /**
   * The third condition of the C4 rule. Without it the member gets a button
   * that leads to a page with nothing on it.
   */
  it('explains that renewals are not open instead of offering a dead button', async () => {
    mockExecute.mockResolvedValue([
      membership({ daysRemaining: 12, canRenew: false, renewalNotOpen: true }),
    ]);
    render();

    expect(await screen.findByText('Renewals are not open yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });

  it('shows neither a button nor a notice when renewal is simply not due', async () => {
    render();

    await waitFor(() => expect(screen.getByText('Full Member')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
    expect(screen.queryByText('Renewals are not open yet.')).not.toBeInTheDocument();
  });

  it('does not offer renewal on a cancelled membership', async () => {
    mockExecute.mockResolvedValue([
      membership({ status: 'cancelled', canRenew: false, renewalNotOpen: false }),
    ]);
    render();

    await waitFor(() => expect(screen.getByText('Full Member')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });

  it('explains an empty list', async () => {
    mockExecute.mockResolvedValue([]);
    render();

    expect(await screen.findByText('You have no memberships yet.')).toBeInTheDocument();
  });

  it('reports a failure instead of looking empty', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    expect(await screen.findByText('We could not load your memberships.')).toBeInTheDocument();
    expect(screen.queryByText('You have no memberships yet.')).not.toBeInTheDocument();
  });
});
