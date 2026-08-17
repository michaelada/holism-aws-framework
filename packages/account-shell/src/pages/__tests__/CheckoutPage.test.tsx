import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutPage from '../CheckoutPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
const mockConfirmPayment = vi.fn();
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
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ orgCode: 'khpc' }) };
});

/*
 * Stripe is stubbed wholesale. The card form is Stripe's own iframe and cannot
 * be driven in jsdom; what these tests are about is the hold — the countdown,
 * the button, and the cancellation — all of which is our code around it.
 */
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}));

const checkout = (over: Record<string, unknown> = {}) => ({
  paymentId: 'pay-1',
  clientSecret: 'pi_1_secret',
  provider: 'stripe',
  amountDue: 1893,
  handlingFee: 93,
  offlineAmount: 0,
  currency: 'EUR',
  completed: false,
  holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  /*
   * Served by the API rather than configured in this app. Without it the card
   * form is not mounted at all — which is precisely the bug this field exists
   * to fix, and is covered by its own case below.
   */
  publishableKey: 'pk_test_seeded',
  ...over,
});

const respond = (over: Record<string, unknown> = {}) => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) => {
    if (request.url.includes('/abandon')) return Promise.resolve({ abandoned: true });
    if (request.url.includes('/payments/')) return Promise.resolve({ status: 'paid' });
    return Promise.resolve(checkout(over));
  });
};

describe('CheckoutPage — the hold on the payment screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells the member their places are held, and for how long', async () => {
    // The basket has a countdown; this is the screen they are actually looking
    // at while they type a card number.
    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByText('Your places are held for')).toBeInTheDocument();
    expect(screen.getByText(/\d+:\d\d left/)).toBeInTheDocument();
  });

  it('says nothing about holds for an order that holds nothing', async () => {
    // A membership or a jumper is not contended, and a clock beside one would
    // be an expiry the member does not have.
    respond({ holdExpiresAt: null });
    renderWithProviders(<CheckoutPage />);

    await screen.findByTestId('payment-element');
    expect(screen.queryByText('Your places are held for')).not.toBeInTheDocument();
  });

  it('closes the form when the hold lapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    respond({ holdExpiresAt: new Date(Date.now() + 2000).toISOString() });
    renderWithProviders(<CheckoutPage />);

    await vi.waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/no longer held/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeDisabled();
  });

  it('cancels the payment intent when the hold lapses', async () => {
    /*
     * The part that makes the expiry bite. Without it the client secret in this
     * tab stays valid, and a laptop woken an hour later could still pay for a
     * slot that has since gone to somebody else.
     */
    vi.useFakeTimers({ shouldAdvanceTime: true });
    respond({ holdExpiresAt: new Date(Date.now() + 2000).toISOString() });
    renderWithProviders(<CheckoutPage />);

    await vi.waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/account/khpc/checkout/pay-1/abandon',
        method: 'POST',
      })
    );
  });

  it('offers a way back to the basket once the hold has gone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    respond({ holdExpiresAt: new Date(Date.now() + 2000).toISOString() });
    renderWithProviders(<CheckoutPage />);

    await vi.waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole('button', { name: 'Back to basket' })).toBeInTheDocument();
  });

  it('still lets a member with time left pay', async () => {
    mockConfirmPayment.mockResolvedValue({});
    renderWithProviders(<CheckoutPage />);

    const pay = await screen.findByRole('button', { name: 'Pay now' });
    expect(pay).toBeEnabled();

    await userEvent.click(pay);

    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalled());
  });

  it('hides the countdown once the payment is in flight', async () => {
    // A timer ticking down beside "processing" reads as a threat to a payment
    // that has already left, and the hold no longer decides the outcome.
    mockConfirmPayment.mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<CheckoutPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Pay now' }));

    await waitFor(() =>
      expect(screen.queryByText('Your places are held for')).not.toBeInTheDocument()
    );
  });
});


/**
 * The Pay button that could not be pressed.
 *
 * Reported as: the checkout summary showed the right total, and Pay Now was
 * greyed out. The account app read its publishable key from a `VITE_` variable
 * that was not set in this repo, so `loadStripe('')` rejected, `useStripe()`
 * stayed null, and the button was disabled for ever — with nothing on screen to
 * say why, which is indistinguishable from a broken browser.
 *
 * The key now comes from the API, beside the secret key it already holds.
 */
describe('CheckoutPage — mounting the card form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
  });

  it('mounts the card form with the key the API served', async () => {
    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pay now' })).toBeEnabled();
  });

  it('says card payment is unavailable rather than showing a dead button', async () => {
    // The club's configuration, not the member's card — so it says so instead
    // of leaving them pressing a button that cannot work.
    respond({ publishableKey: null });
    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByText(/card payment is not available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay now' })).not.toBeInTheDocument();
  });

  it('does not claim a problem when there is nothing to pay by card', async () => {
    // An order settled entirely offline has no client secret and needs no key.
    respond({ publishableKey: null, clientSecret: null, amountDue: 0 });
    renderWithProviders(<CheckoutPage />);

    await waitFor(() =>
      expect(screen.queryByText(/card payment is not available/i)).not.toBeInTheDocument()
    );
  });
});
