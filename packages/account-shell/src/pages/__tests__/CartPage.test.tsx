import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartPage from '../CartPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
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
    useAccountApi: () => ({ execute: mockExecute, loading: false, error: null, reset: () => undefined }),
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

const cart = (over: Record<string, unknown> = {}) => ({
  id: 'cart-1',
  organisationId: 'org-1',
  currency: 'EUR',
  status: 'open',
  warnings: [],
  items: [
    {
      id: 'item-1',
      itemType: 'event_entry',
      formSummary: [
        { label: 'Rider name', value: 'Niamh Walsh' },
        { label: 'Pony or horse name', value: 'Bramble' },
      ],
      contextRef: {},
      description: 'Summer Regatta — Junior Sculls',
      formSubmissionId: 'sub-1',
      availablePaymentMethods: [
        { id: 'pm-card', name: 'stripe', displayName: 'Pay By Card', isCard: true },
        { id: 'pm-offline', name: 'pay-offline', displayName: 'Pay Offline', isCard: false },
      ],
      quantity: 1,
      unitFee: 2500,
      fee: 2500,
      discountAmount: 0,
      paymentMethodId: 'pm-card',
      paymentMethodName: 'card',
      paymentMethodDisplayName: 'Card',
      isCard: true,
      handlingFeeIncluded: true,
    },
  ],
  totals: {
    offlineSubtotal: 0,
    cardSubtotal: 2500,
    feeBearingBase: 2500,
    handlingFee: { base: 2500, net: 100, tax: 23, total: 123 },
    chargedToCardNow: 2623,
    orderTotal: 2623,
    allocations: { 'item-1': 123 },
  },
  ...over,
});

const render = () =>
  renderWithProviders(<CartPage />, { route: '/khpc/cart', path: '/:orgCode/cart' });

describe('CartPage (F1)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(cart());
  });

  it('lists what is in the basket', async () => {
    render();
    expect(await screen.findByText('Summer Regatta — Junior Sculls')).toBeInTheDocument();
  });

  /**
   * Every figure comes from the server. A second implementation of the fee
   * arithmetic in the browser would eventually disagree with the one that
   * takes the money.
   */
  it('shows the handling fee as its own line, not folded into the total', async () => {
    render();

    expect(await screen.findByText('Handling fee')).toBeInTheDocument();
    expect(screen.getByText('€1.00')).toBeInTheDocument();
    expect(screen.getByText('Tax on handling fee')).toBeInTheDocument();
  });

  it('shows the order total the server calculated', async () => {
    render();
    expect(await screen.findByText('€26.23')).toBeInTheDocument();
  });

  it('distinguishes what is paid now from what is owed to the club', async () => {
    mockExecute.mockResolvedValue(
      cart({
        totals: {
          ...cart().totals,
          offlineSubtotal: 1000,
          chargedToCardNow: 2623,
          orderTotal: 3623,
        },
      })
    );
    render();

    // Confusing these is how a member believes they have paid the club in full.
    expect(await screen.findByText('Paying now by card')).toBeInTheDocument();
    expect(screen.getByText('Paying the club directly (Offline)')).toBeInTheDocument();
    expect(screen.getByText(/paid directly to the club/i)).toBeInTheDocument();
  });

  it('warns when a hold has lapsed, because checkout will refuse', async () => {
    mockExecute.mockResolvedValue(
      cart({ warnings: [{ itemId: 'item-1', code: 'HOLD_EXPIRED', message: 'gone' }] })
    );
    render();

    expect(await screen.findByText(/no longer held/i)).toBeInTheDocument();
  });

  it('reloads after removing an item, because the fee changes', async () => {
    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Summer Regatta — Junior Sculls')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /remove/i }));

    // load, delete, load again.
    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(3));
  });

  it('offers a way to find something when the basket is empty', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue(cart({ items: [] }));
    render();

    expect(await screen.findByText('Your basket is empty.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /find something/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/browse');
  });

  it('goes to checkout', async () => {
    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Summer Regatta — Junior Sculls')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/checkout');
  });

  it('reports a failure rather than looking empty', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render();

    expect(await screen.findByText('We could not load your basket.')).toBeInTheDocument();
    expect(screen.queryByText('Your basket is empty.')).not.toBeInTheDocument();
  });
});
/**
 * Checkout takes a member through a payment provider and a webhook. Beginning
 * that with no connection wastes their time at the worst possible moment, so it
 * is stopped here rather than at the payment step.
 */
describe('CartPage — offline', () => {
  const setOnline = (online: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
  };

  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue(cart());
  });

  afterEach(() => setOnline(true));

  it('will not start checkout, and says why', async () => {
    setOnline(false);
    render();

    await screen.findByRole('button', { name: /checkout/i });
    expect(screen.getByRole('button', { name: /checkout/i })).toBeDisabled();
    expect(screen.getByText(/need a connection/i)).toBeInTheDocument();
  });

  /** The basket itself stays readable — it is what was already fetched. */
  it('still shows what is in the basket', async () => {
    setOnline(false);
    render();

    expect(await screen.findByText(/Summer Regatta/)).toBeInTheDocument();
  });

  it('summarises what the member filled in, so it can be checked before paying', async () => {
    // Between the form and the club receiving the entry this is their only
    // sight of it.
    render();

    await screen.findByText('Summer Regatta — Junior Sculls');
    await userEvent.click(screen.getByText('Click to see your 2 entry form values'));

    expect(screen.getByText(/Niamh Walsh/)).toBeInTheDocument();
    expect(screen.getByText(/Bramble/)).toBeInTheDocument();
  });

  it('offers a way to correct them', async () => {
    render();

    await screen.findByText('Summer Regatta — Junior Sculls');
    await userEvent.click(screen.getByText('Click to see your 2 entry form values'));

    expect(
      screen.getByRole('button', { name: 'Change answers' })
    ).toBeInTheDocument();
  });

  it('labels the payment-method control so it reads as changeable', async () => {
    render();

    await screen.findByText('Summer Regatta — Junior Sculls');
    expect(screen.getByText('Change Payment Method')).toBeInTheDocument();
  });

  it('hides "paying now" when there is nothing to charge', async () => {
    // An entirely offline basket has nothing to pay by card, and a €0.00 line
    // answers a question nobody asked.
    mockExecute.mockResolvedValue(
      cart({
        totals: {
          ...cart().totals,
          offlineSubtotal: 5000,
          chargedToCardNow: 0,
        },
      })
    );
    render();

    await screen.findByText('Summer Regatta — Junior Sculls');
    expect(screen.queryByText('Paying now by card')).not.toBeInTheDocument();
  });

  describe('the offline note', () => {
    it('says "part of" only when part of the order is on a card', async () => {
      mockExecute.mockResolvedValue(
        cart({
          totals: { ...cart().totals, offlineSubtotal: 5000, chargedToCardNow: 3000 },
        })
      );
      render();

      await screen.findByText('Summer Regatta — Junior Sculls');
      expect(screen.getByText(/^Part of this order/)).toBeInTheDocument();
    });

    it('speaks of the whole order when nothing is on a card', async () => {
      // Otherwise it tells the member about a card payment that is never going
      // to happen, which invites them to go looking for it.
      mockExecute.mockResolvedValue(
        cart({
          totals: { ...cart().totals, offlineSubtotal: 5000, chargedToCardNow: 0 },
        })
      );
      render();

      await screen.findByText('Summer Regatta — Junior Sculls');
      expect(screen.queryByText(/^Part of this order/)).not.toBeInTheDocument();
      expect(screen.getByText(/^This order is paid directly/)).toBeInTheDocument();
    });
  });

  describe('the item marks', () => {
    it('draws a booking with its own calendar icon and colour', async () => {
      mockExecute.mockResolvedValue(
        cart({
          items: [
            {
              ...cart().items[0],
              itemType: 'booking',
              description: 'Outdoor arena — Saturday',
              icon: 'equestrian',
              colour: '#2e7d32',
            },
          ],
        })
      );
      render();

      await screen.findByText('Outdoor arena — Saturday');
      // The club chose this mark for that calendar; a court and an arena are
      // meant to be told apart.
      expect(document.querySelector('[data-testid="BedroomBabyIcon"]')).toBeInTheDocument();
    });

    it('falls back to a mark for the item’s type', async () => {
      render();

      await screen.findByText('Summer Regatta — Junior Sculls');
      // One event entry is not visually distinct from another.
      expect(document.querySelector('[data-testid="EventIcon"]')).toBeInTheDocument();
    });

    it('marks a shop line as a purchase', async () => {
      mockExecute.mockResolvedValue(
        cart({
          items: [{ ...cart().items[0], itemType: 'merchandise', description: 'Club polo' }],
        })
      );
      render();

      await screen.findByText('Club polo');
      expect(document.querySelector('[data-testid="ShoppingBagIcon"]')).toBeInTheDocument();
    });
  });
});
