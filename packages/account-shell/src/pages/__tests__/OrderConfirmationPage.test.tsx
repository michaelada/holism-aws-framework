import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderConfirmationPage from '../OrderConfirmationPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AccountApiError } from '../../hooks/useAccountApi';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({ execute: mockExecute, loading: false, error: null, reset: () => undefined }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const payment = (over: Record<string, unknown> = {}) => ({
  paymentId: 'pay-1',
  status: 'paid',
  amount: 2623,
  handlingFee: 123,
  offlineAmount: 0,
  currency: 'EUR',
  failureMessage: null,
  ...over,
});

const render = () =>
  renderWithProviders(<OrderConfirmationPage />, {
    route: '/khpc/orders/pay-1',
    path: '/:orgCode/orders/:paymentId',
  });

describe('OrderConfirmationPage (F3)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    mockExecute.mockResolvedValue(payment());
  });

  it('confirms a paid order', async () => {
    render();
    expect(await screen.findByText('Order confirmed')).toBeInTheDocument();
    expect(screen.getByText('€26.23')).toBeInTheDocument();
  });

  /**
   * The member may beat the webhook by a second or two. Showing a receipt for
   * an order that has not been placed is a false confirmation.
   */
  it('says it is still confirming rather than claiming success', async () => {
    mockExecute.mockResolvedValue(payment({ status: 'pending' }));
    render();

    expect(await screen.findByText('Confirming your order')).toBeInTheDocument();
    expect(screen.queryByText('Order confirmed')).not.toBeInTheDocument();
  });

  it('keeps checking while the payment is pending', async () => {
    mockExecute.mockResolvedValue(payment({ status: 'pending' }));
    render();

    await waitFor(() => expect(screen.getByText('Confirming your order')).toBeInTheDocument());
    // Polls rather than leaving the member on a stale page.
    await waitFor(() => expect(mockExecute.mock.calls.length).toBeGreaterThan(1), {
      timeout: 5000,
    });
  });

  it('stops polling once the payment settles', async () => {
    mockExecute.mockResolvedValue(payment({ status: 'paid' }));
    render();

    await waitFor(() => expect(screen.getByText('Order confirmed')).toBeInTheDocument());
    const calls = mockExecute.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(mockExecute.mock.calls.length).toBe(calls);
  });

  it('shows the club what is still owed on an offline order', async () => {
    mockExecute.mockResolvedValue(
      payment({ status: 'awaiting_offline', amount: 0, offlineAmount: 2500 })
    );
    render();

    expect(await screen.findByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('Due to the club')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
  });

  it('shows the provider reason for a failed payment', async () => {
    mockExecute.mockResolvedValue(
      payment({ status: 'failed', failureMessage: 'Your card was declined' })
    );
    render();

    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByText('Your card was declined')).toBeInTheDocument();
  });

  it('sends a failed order back to the basket to retry', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue(payment({ status: 'failed' }));
    render();

    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/cart');
  });

  it("refuses another member's order", async () => {
    mockExecute.mockRejectedValue(new AccountApiError('gone', 404));
    render();

    expect(await screen.findByText('We could not find that order.')).toBeInTheDocument();
  });
});
