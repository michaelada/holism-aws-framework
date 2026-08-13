import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyRegistrationsPage from '../MyRegistrationsPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountRegistration } from '../../types/account';

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
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const registration = (over: Partial<AccountRegistration> = {}): AccountRegistration => ({
  id: 'reg-1',
  registrationNumber: 'REG-000048',
  registrationTypeId: 'rt-1',
  typeName: 'Horse registration 2026',
  entityLabel: 'Horse',
  entityName: 'Rocket',
  ownerName: 'Sam Rivers',
  validUntil: '2026-12-31',
  dateLastRenewed: '2026-01-05',
  registrationStatus: 'active',
  paymentStatus: 'paid',
  status: 'confirmed',
  ...over,
});

/**
 * C6 — what the member has registered.
 *
 * The thing is the headline, not the scheme: a member with three horses is
 * looking for "Rocket". Two statuses again — the shared chip is about the
 * money, the club's own is about approval.
 */
describe('MyRegistrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([registration()]);
  });

  it('leads with the thing, labelled by the club’s word for it', async () => {
    renderWithProviders(<MyRegistrationsPage />);

    expect(await screen.findByText('Rocket')).toBeInTheDocument();
    expect(screen.getByText(/Horse · Horse registration 2026/)).toBeInTheDocument();
    expect(screen.getByText('REG-000048')).toBeInTheDocument();
  });

  it('asks only for this member’s registrations in this organisation', async () => {
    renderWithProviders(<MyRegistrationsPage />);

    await screen.findByText('Rocket');
    expect(mockExecute).toHaveBeenCalledWith({
      url: `/api/account/${contextValue.orgCode}/registrations`,
    });
  });

  it('shows the payment state', async () => {
    renderWithProviders(<MyRegistrationsPage />);

    expect(await screen.findByText('Confirmed')).toBeInTheDocument();
  });

  /** Paid and not yet in force is news the payment chip cannot carry. */
  it('shows that the club has still to approve it', async () => {
    mockExecute.mockResolvedValue([registration({ registrationStatus: 'pending' })]);
    renderWithProviders(<MyRegistrationsPage />);

    expect(await screen.findByText('Awaiting approval')).toBeInTheDocument();
  });

  it('says nothing extra once it is active', async () => {
    renderWithProviders(<MyRegistrationsPage />);

    await screen.findByText('Rocket');
    expect(screen.queryByText('Awaiting approval')).not.toBeInTheDocument();
  });

  it('sends a member with none to the registrations catalogue', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<MyRegistrationsPage />);

    expect(await screen.findByText(/not registered anything yet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'See what you can register' }));
    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/register-interest`);
  });

  it('reports a failure rather than claiming there are none', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<MyRegistrationsPage />);

    expect(await screen.findByText(/could not load registrations/i)).toBeInTheDocument();
    expect(screen.queryByText(/not registered anything yet/i)).not.toBeInTheDocument();
  });
});
