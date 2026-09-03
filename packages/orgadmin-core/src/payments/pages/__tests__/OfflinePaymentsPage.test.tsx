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

vi.mock('@itsplainsailing/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

vi.mock('../../../hooks/useApi');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

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

      /*
       * And it must not look like good news. This shipped as a green success
       * alert with a tick beside the words "could not be created" — the one
       * pairing certain to be read as "done" and skimmed past, while a member
       * has paid and has nothing.
       */
      expect(screen.getByRole('alert').className).toMatch(/standardWarning/);
    });

    it('does show plain success when everything was created', async () => {
      // The counterpart: a clean settlement must not be dressed as a warning
      // either, or the distinction stops carrying any information at all.
      mockExecute.mockImplementation((request: { method?: string }) =>
        request.method === 'POST'
          ? Promise.resolve({ fulfilment: { fulfilled: 2, failed: 0, complete: true } })
          : Promise.resolve([payment()])
      );
      renderWithProviders(<OfflinePaymentsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /Mark received/i }));

      expect((await screen.findByRole('alert')).className).toMatch(/standardSuccess/);
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

  describe('reads the list once', () => {
    /*
     * This page shipped with an unbounded request loop, and none of the tests
     * above saw it — because the shell test double returns a stable `t` from
     * module scope, while the real hook built a fresh one on every render. The
     * mock was more correct than production, so the suite stayed green while a
     * browser issued requests until the API answered 429 and Chrome ran out of
     * sockets with ERR_INSUFFICIENT_RESOURCES.
     *
     * The hook is fixed and orgadmin-shell guards it directly. This guards the
     * page from the other side: even handed the churning `t` that production
     * actually had, the loader must not be rebuilt, because it must not name
     * `t` at all.
     */
    it('does not refetch when the translation function churns', async () => {
      const shell = await import('../../../test/orgadminShellMock');
      const stable = shell.useTranslation();

      // Exactly the old defect: a new `t` closure per render.
      const churning = vi
        .spyOn(shell, 'useTranslation')
        .mockImplementation(() => ({
          ...stable,
          t: (key: string, options?: Record<string, unknown>) => stable.t(key, options),
        }));

      const { rerender } = renderWithProviders(<OfflinePaymentsPage />);
      rerender(<OfflinePaymentsPage />);
      rerender(<OfflinePaymentsPage />);
      rerender(<OfflinePaymentsPage />);

      /*
       * Settle first, so a loop has every chance to fire — the re-entrant
       * fetches were queued rather than synchronous, so an immediate count
       * would read 1 even against the broken version.
       */
      await waitFor(() => expect(mockExecute).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

      expect(
        mockExecute.mock.calls.length,
        'the list was re-read on render — `load` is being rebuilt, so something unstable is in its dependency array'
      ).toBe(1);
      expect(screen.getByText('Sam Rivers')).toBeInTheDocument();

      churning.mockRestore();
    });
  });

  describe('the way useApi actually reports failure', () => {
    /*
     * `execute` returns null on failure; it does not throw. The test above
     * rejects, which is something a browser never does — so the page's `catch`
     * was passing tests while a real failure fell through to
     * `Array.isArray(null)` and rendered "Nothing is waiting on an offline
     * payment". That tells a club there is no money to chase at the exact
     * moment nobody could ask.
     */
    it('does not report an outage as an empty list', async () => {
      mockExecute.mockImplementation(async (request: { onError?: (m: string) => void }) => {
        request.onError?.('Request failed with status code 500');
        return null;
      });
      renderWithProviders(<OfflinePaymentsPage />);

      expect(await screen.findByText(/could not load offline payments/)).toBeInTheDocument();
      expect(screen.queryByText(/Nothing is waiting/)).not.toBeInTheDocument();
    });

    it('treats a bare null as a failure too', async () => {
      mockExecute.mockResolvedValue(null);
      renderWithProviders(<OfflinePaymentsPage />);

      expect(await screen.findByText(/could not load offline payments/)).toBeInTheDocument();
    });
  });

});

/**
 * Into the payment itself.
 *
 * This card says what is owed and who owes it. The next question — what was in
 * the basket, what has been refunded, how it was settled — is a page away, and
 * was previously a search away.
 */
describe('opening the payment behind a card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
    mockExecute.mockResolvedValue([payment()]);
  });

  it('offers a way through to the payment', async () => {
    renderWithProviders(<OfflinePaymentsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'View payment' }));

    expect(mockNavigate).toHaveBeenCalledWith('/payments/pay-1');
  });

  it('offers it whether or not the money has been recorded', async () => {
    // The card is worth opening either way: before, to check what is owed;
    // after, to see what the receipt released.
    mockExecute.mockResolvedValue([payment({ receivedAt: '2026-08-20T09:00:00Z' })]);
    renderWithProviders(<OfflinePaymentsPage />);

    expect(await screen.findByRole('button', { name: 'View payment' })).toBeInTheDocument();
  });
});
