import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyPaymentsPage from '../MyPaymentsPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountPayment } from '../../types/account';

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

const payment = (over: Partial<AccountPayment> = {}): AccountPayment => ({
  id: 'pay-1',
  status: 'paid',
  currency: 'EUR',
  paymentMethod: 'card',
  paidOn: '2026-08-01T10:00:00.000Z',
  createdAt: '2026-08-01T09:59:00.000Z',
  cardAmount: 5500,
  offlineAmount: 0,
  handlingFee: 150,
  total: 5500,
  offlineReceivedAt: null,
  lines: [
    {
      id: 'line-1',
      itemType: 'merchandise',
      description: 'Club polo — Large',
      fee: 2750,
      handlingFee: 75,
      fulfilled: true,
      fulfilmentError: null,
    },
    {
      id: 'line-2',
      itemType: 'event-entry',
      description: 'Summer Regatta — Junior Sculls',
      fee: 2600,
      handlingFee: 75,
      fulfilled: true,
      fulfilmentError: null,
    },
  ],
  ...over,
});

/**
 * F1 and F2 — receipts, on one screen.
 *
 * A payment's lines are a handful of rows, so the detail expands in place. The
 * total is card plus offline, because one order can be both; `payments.amount`
 * is the legacy column and is deliberately unused.
 */
describe('MyPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([payment()]);
  });

  it('lists what the member has paid', async () => {
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText('€55.00')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it('asks only for this member’s payments in this organisation', async () => {
    renderWithProviders(<MyPaymentsPage />);

    await screen.findByText('€55.00');
    expect(mockExecute).toHaveBeenCalledWith({
      url: `/api/account/${contextValue.orgCode}/payments`,
    });
  });

  it('shows what each payment bought, without leaving the list', async () => {
    renderWithProviders(<MyPaymentsPage />);

    await screen.findByText('€55.00');
    expect(screen.getByText('Club polo — Large')).toBeInTheDocument();
    expect(screen.getByText('Summer Regatta — Junior Sculls')).toBeInTheDocument();
    expect(screen.getByText('Handling fee')).toBeInTheDocument();
  });

  /** One order, two ways of paying — the case `payments.amount` cannot express. */
  it('splits card from offline only when the order was genuinely both', async () => {
    mockExecute.mockResolvedValue([
      payment({ cardAmount: 3000, offlineAmount: 2500, total: 5500 }),
    ]);
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText('Paid by card')).toBeInTheDocument();
    expect(screen.getByText('Paid offline')).toBeInTheDocument();
    expect(screen.getByText('€30.00')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
  });

  it('does not split a card-only order', async () => {
    renderWithProviders(<MyPaymentsPage />);

    await screen.findByText('€55.00');
    expect(screen.queryByText('Paid by card')).not.toBeInTheDocument();
  });

  it('says whether the club has recorded an offline payment as received', async () => {
    mockExecute.mockResolvedValue([
      payment({ cardAmount: 0, offlineAmount: 5500, status: 'awaiting_offline' }),
    ]);
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText(/still to record this as received/i)).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('confirms an offline payment once the club records it', async () => {
    mockExecute.mockResolvedValue([
      payment({ cardAmount: 0, offlineAmount: 5500, offlineReceivedAt: '2026-08-09T00:00:00.000Z' }),
    ]);
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText(/recorded this as received on/i)).toBeInTheDocument();
  });

  /**
   * Paid for and produced nothing. It is the club's to fix, but a member told
   * here does not find out at the gate.
   */
  it('surfaces a line that was paid for but never fulfilled', async () => {
    mockExecute.mockResolvedValue([
      payment({
        lines: [
          {
            id: 'line-1',
            itemType: 'booking',
            description: 'Tennis court 1 — 8 August 09:00',
            fee: 1200,
            handlingFee: 0,
            fulfilled: false,
            fulfilmentError: 'That slot is fully booked',
          },
        ],
      }),
    ]);
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText(/That slot is fully booked/)).toBeInTheDocument();
  });

  it('falls back to the club’s own word for a status it has no wording for', async () => {
    mockExecute.mockResolvedValue([payment({ status: 'part_refunded' })]);
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText('part_refunded')).toBeInTheDocument();
  });

  it('says so when there is nothing to show', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText(/not paid for anything yet/i)).toBeInTheDocument();
  });

  it('reports a failure rather than claiming there are no payments', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText(/could not load your payments/i)).toBeInTheDocument();
    expect(screen.queryByText(/not paid for anything yet/i)).not.toBeInTheDocument();
  });
});
