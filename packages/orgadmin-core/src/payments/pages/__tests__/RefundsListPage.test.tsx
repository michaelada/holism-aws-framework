import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RefundsListPage, { isFullRefund } from '../RefundsListPage';
import * as useApiModule from '../../../hooks/useApi';
import { TEST_ORGANISATION } from '../../../test/renderWithProviders';
import { OrganisationProvider } from '../../../context/OrganisationContext';

/**
 * Money that went back out.
 *
 * Its own screen rather than a status filter on the payments list: a list
 * filtered to `refunded` shows the payments at their original amounts, says
 * nothing about how much of each was returned, and misses a payment only part
 * of which was refunded — which stays `paid`, because there is no partial
 * status in this application.
 */

vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));
vi.mock('../../../hooks/useApi');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

const refund = (over: Record<string, unknown> = {}) => ({
  id: 'refund-1',
  paymentId: 'pay-1',
  refundAmount: 25,
  refundReason: 'Withdrew before the closing date',
  refundStatus: 'completed',
  refundDate: '2026-08-30T09:00:00Z',
  requestedAt: '2026-08-30T09:00:00Z',
  requestedByName: 'Aoife Byrne',
  requestedByEmail: 'admin@kildarehunt.test',
  paymentAmount: 185.23,
  paymentStatus: 'paid',
  paymentMethod: 'card',
  payerName: 'Áine McGrath',
  payerEmail: 'aine@example.test',
  ...over,
});

const mockExecute = vi.fn();

const renderPage = () =>
  render(
    <OrganisationProvider organisation={TEST_ORGANISATION}>
      <BrowserRouter>
        <RefundsListPage />
      </BrowserRouter>
    </OrganisationProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApiModule.useApi).mockReturnValue({
    execute: mockExecute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  });
  mockExecute.mockResolvedValue([refund()]);
});

describe('RefundsListPage', () => {
  it('asks the club for its own refunds', async () => {
    renderPage();

    await screen.findByText('Áine McGrath');
    expect(mockExecute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/refunds',
    });
  });

  it('shows what went back, to whom, and who authorised it', async () => {
    renderPage();

    expect(await screen.findByText('Áine McGrath')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
    expect(screen.getByText('Aoife Byrne')).toBeInTheDocument();
    expect(screen.getByText('Withdrew before the closing date')).toBeInTheDocument();
  });

  it('says whether the whole payment went back or part of it', async () => {
    // €25 of a €185 basket is not a reversed payment, and a list that does not
    // say so reads as though it were.
    mockExecute.mockResolvedValue([refund(), refund({ id: 'r2', refundAmount: 185.23 })]);
    renderPage();

    expect(await screen.findByText('in part')).toBeInTheDocument();
    expect(screen.getByText('in full')).toBeInTheDocument();
  });

  it('marks a refund that has been asked for but not sent', async () => {
    mockExecute.mockResolvedValue([refund({ refundStatus: 'pending' })]);
    renderPage();

    expect(await screen.findByText('Awaiting transfer')).toBeInTheDocument();
  });

  it('opens the payment behind a refund', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Open the payment' }));
    expect(mockNavigate).toHaveBeenCalledWith('/payments/pay-1');
  });

  it('names an administrator who has since been removed', async () => {
    mockExecute.mockResolvedValue([
      refund({ requestedByName: null, requestedByEmail: null }),
    ]);
    renderPage();

    // The refund stands whether or not the person who authorised it does.
    expect(await screen.findByText('No longer an administrator')).toBeInTheDocument();
  });

  it('says a club has refunded nothing', async () => {
    mockExecute.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No refunds have been made.')).toBeInTheDocument();
  });

  it('tells a failure apart from a club with no refunds', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText('We could not load the refunds.')).toBeInTheDocument();
    expect(screen.queryByText('No refunds have been made.')).not.toBeInTheDocument();
  });
});

describe('isFullRefund', () => {
  it('is true only when the whole payment went back', () => {
    expect(isFullRefund(refund({ refundAmount: 185.23 }) as never)).toBe(true);
    expect(isFullRefund(refund({ refundAmount: 25 }) as never)).toBe(false);
  });

  it('treats a rounding overshoot as a full refund', () => {
    // Two part refunds summing a cent over the total is a full refund, not a
    // partial one.
    expect(isFullRefund(refund({ refundAmount: 185.24 }) as never)).toBe(true);
  });
});
