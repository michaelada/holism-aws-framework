/**
 * One lodgement, and the payments that made it up.
 *
 * A club sees a figure on its bank statement and needs to know whose money it
 * is, what they bought, and why the figure is not the sum of what they were
 * charged. So the assertions here are about the arithmetic being both correct
 * and *legible* — a total that does not visibly add up is worse than no total.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LodgementDetailPage from '../LodgementDetailPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

vi.mock('../../../hooks/useApi');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'po_1' }),
}));

const mockExecute = vi.fn();

const line = (over: Record<string, unknown> = {}) => ({
  id: 'txn_1',
  type: 'payment',
  description: 'Payment',
  createdAt: '2026-08-11T09:00:00.000Z',
  net: 17500,
  currency: 'EUR',
  paymentId: 'pay-1',
  memberName: 'Sinéad Gallagher',
  memberEmail: 'sinead@example.test',
  grossCharged: 18000,
  applicationFee: 500,
  basket: [
    { description: 'Family Membership 2026', itemType: 'membership', quantity: 1, fee: 17000, handlingFee: 0 },
    { description: 'Cross-country entry', itemType: 'event', quantity: 2, fee: 500, handlingFee: 0 },
  ],
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'po_1',
  arrivalDate: '2026-08-14T00:00:00.000Z',
  amount: 210400,
  currency: 'EUR',
  status: 'paid',
  failureMessage: null,
  destination: 'AIB ····6789',
  lines: [line()],
  totalCharged: 18000,
  totalFees: 500,
  totalRefunded: 0,
  ...over,
});

describe('LodgementDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(detail());
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      loading: false,
      error: null,
    } as never);
  });

  it('shows how the lodgement adds up, ending at what reached the bank', async () => {
    renderWithProviders(<LodgementDetailPage />);

    expect(await screen.findByText('How this adds up')).toBeInTheDocument();
    expect(screen.getByText('Into your bank')).toBeInTheDocument();
    expect(screen.getAllByText('€2,104.00').length).toBeGreaterThan(0);
  });

  it('says who pays Stripe’s fee, because its absence is otherwise unexplained', async () => {
    /*
     * Under destination charges the platform pays it, so it does not reduce the
     * club's money. Leaving it out silently is indistinguishable from having
     * forgotten it, and a treasurer checking the arithmetic would go looking.
     */
    renderWithProviders(<LodgementDetailPage />);

    expect(
      await screen.findByText(/processing fee is paid by the platform/)
    ).toBeInTheDocument();
  });

  it('shows both numbers per payment: charged, and what reached the bank', async () => {
    /*
     * The gap between them is the platform's cut, and is the reason the screen
     * exists. Scoped to the row: with a single payment the same figures also
     * appear in the summary above, and a bare `getByText` would pass on either
     * without proving the row carries both.
     */
    renderWithProviders(<LodgementDetailPage />);

    const row = (await screen.findByText('Sinéad Gallagher')).closest('tr')!;
    expect(within(row).getByText('€180.00')).toBeInTheDocument();
    expect(within(row).getByText('€175.00')).toBeInTheDocument();
  });

  it('reveals the basket and the fee build-up on expanding a payment', async () => {
    renderWithProviders(<LodgementDetailPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Show basket/i }));

    expect(await screen.findByText('Family Membership 2026')).toBeInTheDocument();
    expect(screen.getByText('Charged to the member')).toBeInTheDocument();
    // Twice over: once as the column heading, once closing the build-up below.
    expect(screen.getAllByText('Into this lodgement').length).toBeGreaterThanOrEqual(2);
  });

  it('shows a quantity only when there is more than one', async () => {
    // "Family Membership 2026 × 1" is noise; "× 2" is information.
    renderWithProviders(<LodgementDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Show basket/i }));

    expect(screen.getByText('Cross-country entry × 2')).toBeInTheDocument();
    expect(screen.getByText('Family Membership 2026')).toBeInTheDocument();
  });

  it('keeps a refund line, and does not offer to expand it', async () => {
    /*
     * Without refunds the column would not sum to the payout total. But a
     * refund has no basket, so an expander on it would open nothing.
     */
    mockExecute.mockResolvedValue(
      detail({
        lines: [
          line(),
          line({
            id: 'txn_2',
            type: 'refund',
            net: -6000,
            paymentId: null,
            memberName: null,
            grossCharged: null,
            applicationFee: null,
            basket: [],
          }),
        ],
        totalRefunded: -6000,
      })
    );
    renderWithProviders(<LodgementDetailPage />);

    const refundRow = (await screen.findByText('Refund')).closest('tr')!;
    expect(within(refundRow).getByText('-€60.00')).toBeInTheDocument();
    // One expander, for the one payment that has a basket.
    expect(screen.getAllByRole('button', { name: /Show basket/i })).toHaveLength(1);
  });

  it('shows an unmatched Stripe entry rather than dropping it', async () => {
    /*
     * Dropping it would break the total and read as a bug in the arithmetic.
     * Expected for payments taken before the link was recorded.
     */
    mockExecute.mockResolvedValue(
      detail({
        lines: [
          line({
            paymentId: null,
            memberName: null,
            grossCharged: null,
            applicationFee: null,
            basket: [],
          }),
        ],
        totalCharged: 0,
        totalFees: 0,
      })
    );
    renderWithProviders(<LodgementDetailPage />);

    expect(await screen.findByText(/no matching record here/)).toBeInTheDocument();
    expect(screen.getByText('€175.00')).toBeInTheDocument();
  });

  it('ends on a total that matches the payout', async () => {
    // The reconciliation the whole screen is for.
    renderWithProviders(<LodgementDetailPage />);

    expect(await screen.findByText('Total')).toBeInTheDocument();
  });

  it('surfaces a failed payout’s reason', async () => {
    mockExecute.mockResolvedValue(
      detail({ status: 'failed', failureMessage: 'The bank account was rejected.' })
    );
    renderWithProviders(<LodgementDetailPage />);

    expect(await screen.findByText('The bank account was rejected.')).toBeInTheDocument();
  });

  it('hands off to the payment page rather than acting itself', async () => {
    // Refunds live on PaymentDetailsPage; this screen reports.
    renderWithProviders(<LodgementDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Show basket/i }));

    await userEvent.click(screen.getByRole('button', { name: /View payment/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/payments/pay-1');
  });

  it('offers a way back that still works when the load failed', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<LodgementDetailPage />);

    expect(await screen.findByText(/could not load this lodgement/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Lodgements/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/payments/lodgements');
  });
});
