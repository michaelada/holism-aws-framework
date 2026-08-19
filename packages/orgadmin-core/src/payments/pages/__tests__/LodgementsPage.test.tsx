/**
 * Lodgements — what actually reached the bank.
 *
 * This screen replaced one that summed our own `payments` table by day. The
 * assertions here are mostly about the difference between "no money" and other
 * things that produce an empty table, because that distinction is what a club
 * reads the screen for.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LodgementsPage from '../LodgementsPage';
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
}));

const mockExecute = vi.fn();

const lodgement = (over: Record<string, unknown> = {}) => ({
  id: 'po_1',
  arrivalDate: '2026-08-14T00:00:00.000Z',
  amount: 210400,
  currency: 'EUR',
  status: 'paid',
  failureMessage: null,
  destination: 'AIB ····6789',
  ...over,
});

const page = (over: Record<string, unknown> = {}) => ({
  lodgements: [lodgement()],
  nextCursor: null,
  notYetPaidOut: null,
  ...over,
});

describe('LodgementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    /*
     * `clearAllMocks` empties recorded calls but leaves queued
     * `mockResolvedValueOnce` values in place. The paging test queues two, and
     * any left unconsumed fire in whichever test runs next — which is how three
     * tests here passed alone and failed in a suite. `mockReset` drains them.
     */
    mockExecute.mockReset();
    mockExecute.mockResolvedValue(page());
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      loading: false,
      error: null,
    } as never);
  });

  it('lists what reached the bank, with the account it went to', async () => {
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText('AIB ····6789')).toBeInTheDocument();
    expect(screen.getByText('€2,104.00')).toBeInTheDocument();
  });

  it('shows money not yet paid out as a card, never as a lodgement row', async () => {
    /*
     * It has no date and has not moved. A row would claim a lodgement that has
     * not happened, and would not appear on any bank statement.
     */
    mockExecute.mockResolvedValue(
      page({ notYetPaidOut: { amount: 41280, currency: 'EUR' } })
    );
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText(/Not yet paid out/)).toBeInTheDocument();
    // One row in the table, not two.
    expect(screen.getAllByRole('row')).toHaveLength(2); // header + one lodgement
  });

  it('puts a failure reason on the row rather than behind a click', async () => {
    // Somebody opening this screen is usually asking where money has got to.
    mockExecute.mockResolvedValue(
      page({
        lodgements: [
          lodgement({ status: 'failed', failureMessage: 'The bank account was rejected.' }),
        ],
      })
    );
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText('The bank account was rejected.')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('distinguishes "not connected" from "no lodgements", and offers the remedy', async () => {
    /*
     * The whole point of separating these. An empty table for an unconnected
     * club reads as "no money has come in", which is alarming and wrong — the
     * truth is that no money ever could until Stripe is connected.
     */
    mockExecute.mockRejectedValue(new Error('This organisation is not connected to Stripe'));
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText(/not connected to Stripe yet/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Payment Settings/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings?tab=payments');
  });

  it('tells a club whose Stripe access was revoked how to fix it', async () => {
    /*
     * Found in development, where the stored connected account belonged to a
     * different Stripe platform than the key — which is the same shape as a club
     * that disconnects in production. It used to surface as a bare 500 and a
     * "could not load" message, which is true and useless.
     *
     * The match is on the backend's wording, so it is asserted on both sides:
     * `useApi` surfaces only the message, not the error code.
     */
    mockExecute.mockRejectedValue(
      new Error("This organisation's Stripe connection is no longer valid. Reconnect it in Payment Settings.")
    );
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText(/no longer valid/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Payment Settings/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings?tab=payments');
  });

  it('says so plainly when a connected club simply has none yet', async () => {
    mockExecute.mockResolvedValue(page({ lodgements: [] }));
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText(/No lodgements yet/)).toBeInTheDocument();
  });

  it('reports a real failure as a failure', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<LodgementsPage />);

    expect(await screen.findByText(/could not load your lodgements/)).toBeInTheDocument();
  });

  describe('the way useApi actually reports failure', () => {
    /*
     * `execute` **returns null**; it does not throw. Every test above that
     * rejects is describing something a browser never does, and a page relying
     * on `catch` alone shows its empty state instead of its error — which on
     * this screen means telling a club that no money has reached its bank.
     *
     * These reproduce the real contract: resolve null, and call `onError`.
     */
    const failWith = (message: string) =>
      mockExecute.mockImplementation(async (request: { onError?: (m: string) => void }) => {
        request.onError?.(message);
        return null;
      });

    it('does not report an outage as "no lodgements"', async () => {
      failWith('Request failed with status code 500');
      renderWithProviders(<LodgementsPage />);

      expect(await screen.findByText(/could not load your lodgements/)).toBeInTheDocument();
      expect(screen.queryByText(/No lodgements yet/)).not.toBeInTheDocument();
    });

    it('still recognises a club that has never connected', async () => {
      failWith('This organisation is not connected to Stripe');
      renderWithProviders(<LodgementsPage />);

      expect(await screen.findByText(/not connected to Stripe yet/)).toBeInTheDocument();
    });

    it('still recognises a connection that has been revoked', async () => {
      failWith("This organisation's Stripe connection is no longer valid. Reconnect it in Payment Settings.");
      renderWithProviders(<LodgementsPage />);

      expect(await screen.findByText(/no longer valid/)).toBeInTheDocument();
    });

    it('treats a bare null with no message as a failure, not an empty list', async () => {
      // Belt and braces: if `onError` is never called, null alone still means
      // the request did not succeed.
      mockExecute.mockResolvedValue(null);
      renderWithProviders(<LodgementsPage />);

      expect(await screen.findByText(/could not load your lodgements/)).toBeInTheDocument();
    });
  });

  it('opens the drill-down when a lodgement is clicked', async () => {
    renderWithProviders(<LodgementsPage />);

    await userEvent.click(await screen.findByText('AIB ····6789'));

    expect(mockNavigate).toHaveBeenCalledWith('/payments/lodgements/po_1');
  });

  describe('paging', () => {
    it('offers more only when Stripe says there is more', async () => {
      renderWithProviders(<LodgementsPage />);
      await screen.findByText('AIB ····6789');

      expect(screen.queryByRole('button', { name: /Show more/i })).not.toBeInTheDocument();
    });

    it('appends the next page rather than replacing the list', async () => {
      // Cursor paging with no total: replacing would lose everything above.
      mockExecute
        .mockResolvedValueOnce(page({ nextCursor: 'po_1' }))
        .mockResolvedValueOnce(
          page({ lodgements: [lodgement({ id: 'po_2', destination: 'BOI ····1234' })] })
        );
      renderWithProviders(<LodgementsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /Show more/i }));

      await waitFor(() => expect(screen.getByText('BOI ····1234')).toBeInTheDocument());
      expect(screen.getByText('AIB ····6789')).toBeInTheDocument();
      expect(mockExecute).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: expect.stringContaining('cursor=po_1') })
      );
    });
  });

  it('reads the list once, whatever re-renders', async () => {
    /*
     * The failure that took the offline payments screen down: a loader keyed on
     * something rebuilt every render fetches without end. Guarded here too,
     * against the churning `t` production once had.
     */
    const shell = await import('../../../test/orgadminShellMock');
    const stable = shell.useTranslation();
    const churning = vi.spyOn(shell, 'useTranslation').mockImplementation(() => ({
      ...stable,
      t: (key: string, options?: Record<string, unknown>) => stable.t(key, options),
    }));

    const { rerender } = renderWithProviders(<LodgementsPage />);
    rerender(<LodgementsPage />);
    rerender(<LodgementsPage />);

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    expect(
      mockExecute.mock.calls.length,
      'the list was re-read on render — something unstable is in the loader’s dependencies'
    ).toBe(1);

    churning.mockRestore();
  });
});
