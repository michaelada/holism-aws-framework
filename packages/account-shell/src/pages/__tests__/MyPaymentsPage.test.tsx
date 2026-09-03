import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyPaymentsPage from '../MyPaymentsPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { lineDestination } from '../MyPaymentsPage';
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
      fulfilmentRef: 'order-1',
      subjectName: null,
    },
    {
      id: 'line-2',
      itemType: 'event_entry',
      description: 'Summer Regatta — Junior Sculls',
      fee: 2600,
      handlingFee: 75,
      fulfilled: true,
      fulfilmentError: null,
      fulfilmentRef: 'entry-7',
      subjectName: 'Rónán McGrath',
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

    // Twice now: the figure on the summary, and the Total line in the
    // breakdown that explains the handling fee inside it.
    expect((await screen.findAllByText('€55.00')).length).toBeGreaterThan(0);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it('asks only for this member’s payments in this organisation', async () => {
    renderWithProviders(<MyPaymentsPage />);

    await screen.findAllByText('€55.00');
    expect(mockExecute).toHaveBeenCalledWith({
      url: `/api/account/${contextValue.orgCode}/payments`,
    });
  });

  it('shows what each payment bought, without leaving the list', async () => {
    renderWithProviders(<MyPaymentsPage />);

    await screen.findAllByText('€55.00');
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

    await screen.findAllByText('€55.00');
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

/**
 * A payment's detail, itemised.
 *
 * One payment can cover a whole basket — two children entered, a membership
 * renewed, a shirt — and as four descriptions and four figures it answers
 * neither "who was this for" nor "where did it go". The description cannot
 * answer the first: it is composed when the basket is filled, so two children
 * in one class give two identical lines.
 */
describe('MyPaymentsPage — what each line was for', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([payment()]);
  });

  it('names who the line was for, beside what was bought', async () => {
    renderWithProviders(<MyPaymentsPage />);

    expect(await screen.findByText('Summer Regatta — Junior Sculls')).toBeInTheDocument();
    expect(screen.getByText('Rónán McGrath')).toBeInTheDocument();
  });

  it('offers a way through to the record the line produced', async () => {
    renderWithProviders(<MyPaymentsPage />);

    await screen.findByText('Summer Regatta — Junior Sculls');

    // A link per line, labelled for what it opens.
    expect(screen.getByText('View entry')).toBeInTheDocument();
    expect(screen.getByText('View order')).toBeInTheDocument();
  });

  it('takes the member to the entry when they follow it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyPaymentsPage />);

    await user.click(await screen.findByText('View entry'));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc/entries/entry-7');
  });
});

/**
 * Where each kind of line leads.
 *
 * Entries and merchandise have a record of their own; memberships,
 * registrations and bookings do not yet, so they lead to the list that holds
 * them — which still answers "where did this money go".
 */
/**
 * A payment that carries a handling fee has to explain itself.
 *
 * The lines add up to less than the figure at the top, and without the
 * breakdown nothing says why. It matters most on a basket where some items
 * absorb their fee and some do not, and where some were paid by card and some
 * are owed to the club.
 */
describe('MyPaymentsPage — the money, broken down', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
  });

  it('shows subtotal, handling fee and total when a fee was charged', async () => {
    mockExecute.mockResolvedValue([payment()]);
    renderWithProviders(<MyPaymentsPage />);

    await screen.findAllByText('€55.00');
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Handling fee')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    // 55.00 total less the 1.50 fee.
    expect(screen.getByText('€53.50')).toBeInTheDocument();
  });

  /* With no fee the lines already sum to the total; three more rows would say it twice. */
  it('leaves the breakdown out when there was no fee', async () => {
    mockExecute.mockResolvedValue([payment({ handlingFee: 0 })]);
    renderWithProviders(<MyPaymentsPage />);

    await screen.findAllByText('€55.00');
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
    expect(screen.queryByText('Handling fee')).not.toBeInTheDocument();
  });

  /*
   * Which lines bore the fee, on the lines themselves. An item whose price
   * already absorbs it shows nothing — the difference between "included" and
   * "added on", where the member can see which is which.
   */
  it('marks the lines that bore the fee, and only those', async () => {
    mockExecute.mockResolvedValue([
      payment({
        handlingFee: 100,
        lines: [
          { id: 'l-1', itemType: 'event_entry', description: 'Added on', fee: 2500, handlingFee: 100, fulfilled: true, fulfilmentError: null, fulfilmentRef: 'e-1', subjectName: 'Rónán McGrath' },
          { id: 'l-2', itemType: 'merchandise', description: 'Included', fee: 3800, handlingFee: 0, fulfilled: true, fulfilmentError: null, fulfilmentRef: 'o-1', subjectName: null },
        ],
      }),
    ]);
    renderWithProviders(<MyPaymentsPage />);

    await screen.findByText('Added on');
    expect(screen.getByText('+ €1.00 handling')).toBeInTheDocument();
    expect(screen.getAllByText(/handling$/)).toHaveLength(1);
  });

  /* Part paid now, part owed to the club — the basket the split exists for. */
  it('splits card from offline when the basket was settled both ways', async () => {
    mockExecute.mockResolvedValue([
      payment({ cardAmount: 2461, offlineAmount: 4000, total: 6461, handlingFee: 61 }),
    ]);
    renderWithProviders(<MyPaymentsPage />);

    await screen.findByText('Paid by card');
    expect(screen.getByText('€24.61')).toBeInTheDocument();
    expect(screen.getByText('Paid offline')).toBeInTheDocument();
    expect(screen.getByText('€40.00')).toBeInTheDocument();
  });
});

describe('lineDestination', () => {
  const line = (over: Record<string, unknown> = {}) =>
    ({ itemType: 'event_entry', fulfilmentRef: 'ref-1', ...over }) as never;

  it('opens the entry itself', () => {
    expect(lineDestination(line(), 'khpc')).toBe('/khpc/entries/ref-1');
  });

  /*
   * Not `/orders/:paymentId` — that route is the order **confirmation** for a
   * whole payment, so clicking the hoodie on a four-line basket landed on
   * "Order confirmed, €184". `?order=` names the one the member asked about.
   */
  it('opens the shop orders list at the order that was clicked', () => {
    expect(lineDestination(line({ itemType: 'merchandise' }), 'khpc')).toBe(
      '/khpc/orders?order=ref-1'
    );
  });

  it('falls back to the plain list for a shop line with no order behind it', () => {
    expect(
      lineDestination(line({ itemType: 'merchandise', fulfilmentRef: null }), 'khpc')
    ).toBe('/khpc/orders');
  });

  it('falls back to the list where there is no page for one record', () => {
    expect(lineDestination(line({ itemType: 'membership' }), 'khpc')).toBe(
      '/khpc/memberships'
    );
    expect(lineDestination(line({ itemType: 'registration' }), 'khpc')).toBe(
      '/khpc/registrations'
    );
    expect(lineDestination(line({ itemType: 'booking' }), 'khpc')).toBe('/khpc/entries');
  });

  /*
   * An unfulfilled line has produced nothing — an offline order the club has
   * not recorded yet. A link to nothing is worse than no link.
   */
  it('offers nothing for a line that produced no record', () => {
    expect(lineDestination(line({ fulfilmentRef: null }), 'khpc')).toBeNull();
    expect(
      lineDestination(line({ itemType: 'membership', fulfilmentRef: null }), 'khpc')
    ).toBeNull();
  });

  it('offers nothing before the organisation is known', () => {
    expect(lineDestination(line(), undefined)).toBeNull();
  });
});
