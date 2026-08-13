import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterInterestPage from '../RegisterInterestPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { CatalogueRegistrationType } from '../../types/account';

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

const type = (over: Partial<CatalogueRegistrationType> = {}): CatalogueRegistrationType => ({
  id: 'rt-1',
  name: 'Horse registration 2026',
  description: 'Annual registration',
  entityName: 'Horse',
  registrationFormId: null,
  isRollingRegistration: false,
  validUntil: '2026-12-31',
  numberOfMonths: null,
  automaticallyApprove: true,
  fee: 4500,
  handlingFeeIncluded: false,
  supportedPaymentMethodIds: ['pm-card'],
  termsAndConditions: null,
  available: true,
  unavailableReason: null,
  ...over,
});

/**
 * D7 — what the club will register.
 *
 * The club's word for the thing runs through the screen: "Registers a horse",
 * "Register a horse". A generic label would read as a form nobody understands,
 * and the same page has to work for a boat club.
 */
describe('RegisterInterestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([type()]);
  });

  it('lists what can be registered, in the club’s own words', async () => {
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText('Horse registration 2026')).toBeInTheDocument();
    expect(screen.getByText('Registers a Horse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register a Horse' })).toBeEnabled();
    expect(screen.getByText('€45.00')).toBeInTheDocument();
  });

  it('opens the registration form', async () => {
    renderWithProviders(<RegisterInterestPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Register a Horse' }));

    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/register-interest/rt-1`);
  });

  it('shows a free registration as free', async () => {
    mockExecute.mockResolvedValue([type({ fee: 0 })]);
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText('Free')).toBeInTheDocument();
  });

  /** How long it lasts is answered two different ways. */
  it('says when a fixed-period registration ends', async () => {
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText(/Until/)).toBeInTheDocument();
  });

  it('says how long a rolling registration runs instead', async () => {
    mockExecute.mockResolvedValue([
      type({ isRollingRegistration: true, numberOfMonths: 12, validUntil: null }),
    ]);
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText('Runs for 12 months')).toBeInTheDocument();
  });

  it('warns that the club reviews these before a member starts', async () => {
    mockExecute.mockResolvedValue([type({ automaticallyApprove: false })]);
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText('The club reviews these')).toBeInTheDocument();
  });

  it('shows a closed registration rather than hiding it', async () => {
    mockExecute.mockResolvedValue([
      type({ available: false, unavailableReason: 'not-open-for-applications' }),
    ]);
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText('Closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register a Horse' })).toBeDisabled();
  });

  it('says so when nothing is open', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText(/nothing open for registration/i)).toBeInTheDocument();
  });

  it('reports a failure rather than an empty club', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<RegisterInterestPage />);

    expect(await screen.findByText(/could not load registrations/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing open for registration/i)).not.toBeInTheDocument();
  });
});
