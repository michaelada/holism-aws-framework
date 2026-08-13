/**
 * Offline payments (I1, I2).
 *
 * The screen that finishes an offline order. Until an administrator marks a
 * payment received, fulfilment holds everything the member bought — so the
 * assertions here are about the consequence of the click, not the click.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflinePaymentsPage from '../OfflinePaymentsPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

vi.mock('../../../hooks/useApi');

const mockExecute = vi.fn();

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  memberName: 'Sam Rivers',
  memberEmail: 'sam@example.com',
  currency: 'EUR',
  status: 'awaiting_offline',
  placedAt: '2026-08-01T10:00:00Z',
  receivedAt: null,
  offlineAmount: 18000,
  cardAmount: 0,
  handlingFee: 0,
  lines: [{ description: 'Family Membership 2026', fee: 18000 }],
  ...over,
});

describe('OfflinePaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue([payment()]);
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      loading: false,
      error: null,
    } as never);
  });

  it('lists what is outstanding, with who owes it and what for', async () => {
    renderWithProviders(<OfflinePaymentsPage />);

    expect(await screen.findByText('Sam Rivers')).toBeInTheDocument();
    expect(screen.getByText('Family Membership 2026')).toBeInTheDocument();
  });

  it('asks for the outstanding ones by default', async () => {
    renderWithProviders(<OfflinePaymentsPage />);

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/organisation/payments/offline?settled=false',
        })
      )
    );
  });

  it('can switch to what has already been recorded', async () => {
    renderWithProviders(<OfflinePaymentsPage />);
    await screen.findByText('Sam Rivers');

    await userEvent.click(screen.getByRole('tab', { name: /Recorded/i }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/organisation/payments/offline?settled=true',
        })
      )
    );
  });

  describe('marking one received', () => {
    it('posts it and re-reads the list', async () => {
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'POST'
          ? Promise.resolve({ fulfilment: { fulfilled: 1, failed: 0, complete: true } })
          : Promise.resolve([payment()])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(
        await screen.findByRole('button', { name: /Mark received/i })
      );

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/organisation/payments/pay-1/received',
          })
        )
      );
    });

    /**
     * The consequence is the point: the member now has the membership that was
     * being held. Saying so is what tells an administrator the job is done.
     */
    it('confirms that the member now has what they paid for', async () => {
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'POST'
          ? Promise.resolve({ fulfilment: { fulfilled: 2, failed: 0, complete: true } })
          : Promise.resolve([payment()])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(
        await screen.findByRole('button', { name: /Mark received/i })
      );

      expect(await screen.findByText(/now has everything they paid for/)).toBeInTheDocument();
    });

    /**
     * A failed line means the member has paid and has nothing. The club needs
     * that now, not when the member rings up.
     */
    it('warns loudly when the money produced nothing', async () => {
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'POST'
          ? Promise.resolve({ fulfilment: { fulfilled: 0, failed: 1, complete: false } })
          : Promise.resolve([payment()])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(
        await screen.findByRole('button', { name: /Mark received/i })
      );

      expect(await screen.findByText(/could not be created for/)).toBeInTheDocument();
    });

    it('reports a refusal from the server', async () => {
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'POST'
          ? Promise.reject(new Error('That payment is not awaiting an offline settlement'))
          : Promise.resolve([payment()])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(
        await screen.findByRole('button', { name: /Mark received/i })
      );

      expect(await screen.findByText(/not awaiting an offline settlement/)).toBeInTheDocument();
    });
  });

  describe('undoing one', () => {
    beforeEach(() => {
      mockExecute.mockResolvedValue([payment({ receivedAt: '2026-08-09T09:00:00Z' })]);
    });

    it('offers undo instead of mark-received once it is recorded', async () => {
      renderWithProviders(<OfflinePaymentsPage />);

      expect(await screen.findByRole('button', { name: /^Undo$/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Mark received/i })
      ).not.toBeInTheDocument();
    });

    it('sends the delete', async () => {
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'DELETE'
          ? Promise.resolve({})
          : Promise.resolve([payment({ receivedAt: '2026-08-09T09:00:00Z' })])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /^Undo$/i }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/orgadmin/organisation/payments/pay-1/received',
          })
        )
      );
    });

    /** The refusal an administrator most needs to read, shown verbatim. */
    it('shows why an undo was refused once records exist', async () => {
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'DELETE'
          ? Promise.reject(
              new Error(
                'This payment has already produced memberships, bookings or orders. Refund it or cancel those individually instead of undoing the receipt.'
              )
            )
          : Promise.resolve([payment({ receivedAt: '2026-08-09T09:00:00Z' })])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /^Undo$/i }));

      expect(
        await screen.findByText(/Refund it or cancel those individually/)
      ).toBeInTheDocument();
    });
  });

  it('says so when there is nothing outstanding', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<OfflinePaymentsPage />);

    expect(await screen.findByText(/Nothing is waiting on an offline payment/)).toBeInTheDocument();
  });

  it('reports a failure rather than an empty list', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<OfflinePaymentsPage />);

    expect(await screen.findByText(/could not load offline payments/)).toBeInTheDocument();
  });
});
