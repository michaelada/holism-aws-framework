/**
 * Unit tests for PaymentDetailsPage component
 * Tests payment details rendering and refund flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PaymentDetailsPage, { lineDestination, itemStatus } from '../PaymentDetailsPage';
import * as useApiModule from '../../../hooks/useApi';
import { TEST_ORGANISATION } from '../../../test/renderWithProviders';
import { OrganisationProvider } from '../../../context/OrganisationContext';

vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));

// Shell hooks (translations, onboarding, page help, capabilities, locale)
// are mocked rather than provided — see test/orgadminShellMock.
vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/*
 * Named the way the API names a payment.
 *
 * These fixtures used to carry `date`, `status`, `type`, `customerName` and a
 * `relatedTransaction` object — none of which the endpoint returns. The page
 * read `payment.relatedTransaction.name` without a guard, so the screen threw
 * before it could paint, while this suite passed against the shape it had
 * invented for itself.
 */
const mockPayment = {
  id: '1',
  paymentDate: '2024-01-15T10:00:00Z',
  createdAt: '2024-01-15T09:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  amount: 50.0,
  currency: 'EUR',
  paymentStatus: 'paid',
  paymentType: 'event',
  paymentMethod: 'card',
  paymentProvider: 'stripe',
  providerTransactionId: 'txn_123456789',
  contextId: 'evt_001',
  userName: 'John Doe',
  userEmail: 'john@example.com',
  lines: [],
  refunds: [],
  settlement: [],
};

/** One line of a basket, as `GET /payments/:id` returns it. */
const line = (over: Record<string, unknown> = {}) => ({
  id: 'line-1',
  itemType: 'event_entry',
  description: 'Intermediate — Kildare Hunt Pony Club',
  fee: 2500,
  handlingFee: 62,
  paymentMethod: 'stripe',
  status: 'paid',
  fulfilled: true,
  fulfilmentRef: 'entry-1',
  subjectName: 'Áine McGrath',
  contextRef: { eventId: 'evt-9' },
  refundedAmount: 0,
  entryStatus: 'active',
  ...over,
});

const mockRefundedPayment = { ...mockPayment, id: '2', paymentStatus: 'refunded' };


/*
 * The club in this harness is EUR (`test/renderWithProviders`), and these
 * assertions used to read £ — the page hard-coded 'GBP' regardless of the
 * organisation, and the tests agreed with it. The currency now comes from the
 * organisation via `useCurrency()`, so the symbol follows the club.
 */
describe('PaymentDetailsPage', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Setup default mock implementation
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const renderComponent = (paymentId = '1') => {
    return render(
      <OrganisationProvider organisation={TEST_ORGANISATION}>
      <BrowserRouter>
        <Routes>
          <Route path="/payments/:id" element={<PaymentDetailsPage />} />
        </Routes>
      </BrowserRouter>
      </OrganisationProvider>,
      { wrapper: ({ children }) => <div>{children}</div> }
    );
  };

  describe('Payment Details Rendering', () => {
    it('should render the page title and back button', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      // Navigate to the payment details page
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment Details')).toBeInTheDocument();
      });
    });

    it('should load and display payment details on mount', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/payments/1',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('€50.00')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching payment', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(screen.getByText('Loading payment details...')).toBeInTheDocument();
    });

    it('should display not found message when payment does not exist', async () => {
      mockExecute.mockResolvedValue(null);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment not found')).toBeInTheDocument();
      });
    });

    it('should display payment information correctly', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment Information')).toBeInTheDocument();
        expect(screen.getByText('€50.00')).toBeInTheDocument();
        expect(screen.getAllByText('Paid')[0]).toBeInTheDocument();
        expect(screen.getAllByText(/Card/)[0]).toBeInTheDocument();
        expect(screen.getByText('txn_123456789')).toBeInTheDocument();
      });
    });

    it('should display customer information correctly', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Customer Information')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        // No phone: the endpoint does not return one, and the page no longer
        // claims otherwise.
      });
    });

    /*
     * The "Related Transaction" card is gone. It named a `contextId` and a type
     * — one line of reference for a basket that may hold four things — and said
     * nothing about who any of them were for. What replaced it is asserted in
     * "What this paid for" below.
     */

    /*
     * The refund card is gone from the page, so there is nothing to assert
     * here. Every field it showed — the refund date, the reason — lives in the
     * `refunds` table and is not returned by `GET /payments/:id`, so for a
     * refunded payment it rendered an empty box with "N/A" in it. See
     * docs/ORGADMIN_PAYMENTS_BROKEN_FIELDS.md.
     */
  });

  describe('Refund Flow', () => {
    it('should show refund button for paid payments', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /request refund/i })).toBeInTheDocument();
      });
    });

    it('should not show refund button for refunded payments', async () => {
      mockExecute.mockResolvedValue(mockRefundedPayment);
      
      window.history.pushState({}, '', '/payments/2');
      renderComponent('2');

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /request refund/i })).not.toBeInTheDocument();
      });
    });

    it('should open refund dialog when refund button is clicked', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      await waitFor(() => {
        // The dialog now asks *how much*, because there are four answers.
        expect(screen.getByText('How much to refund')).toBeInTheDocument();
      });
    });

    it('should disable confirm button when refund reason is empty', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
        expect(confirmButton).toBeDisabled();
      });
    });

    it('should enable confirm button when refund reason is provided', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText(/Refund Reason/);
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
        expect(confirmButton).not.toBeDisabled();
      });
    });

    it('should call refund API when confirm is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce(mockPayment) // Initial load
        .mockResolvedValueOnce({}) // Refund request
        .mockResolvedValueOnce(mockRefundedPayment); // Reload after refund
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText(/Refund Reason/);
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/payments/1/refund',
          /*
           * The scope, not a figure. Only an arbitrary-amount refund sends one;
           * every other scope is the server's to compute, or a client could
           * refund the whole of a payment while calling it one line of it. Who
           * is asking comes from the token, never from the body.
           */
          data: {
            scope: 'full',
            refundAmount: undefined,
            lineIds: undefined,
            refundReason: 'Customer request',
            removeEntries: false,
          },
        });
      });
    });

    it('should close dialog after successful refund', async () => {
      mockExecute
        .mockResolvedValueOnce(mockPayment) // Initial load
        .mockResolvedValueOnce({}) // Refund request
        .mockResolvedValueOnce(mockRefundedPayment); // Reload after refund
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText(/Refund Reason/);
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText('How much to refund')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment not found')).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle refund errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute
        .mockResolvedValueOnce(mockPayment) // Initial load
        .mockRejectedValueOnce(new Error('Refund failed')); // Refund request fails
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText(/Refund Reason/);
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });
  /**
   * What this paid for.
   *
   * A basket may hold an entry for one child, a membership for another and a
   * hoodie, settled part by card and part offline. The page used to show one
   * figure and a reference, which left the club unable to answer "what is this
   * €185 for?" without going to the database.
   */
  describe('What this paid for', () => {
    const basket = {
      ...mockPayment,
      amount: 185.23,
      lines: [
        line(),
        line({
          id: 'line-2',
          itemType: 'membership',
          description: 'Full Member 2026',
          fee: 9600,
          handlingFee: 0,
          paymentMethod: 'pay-offline',
          subjectName: 'Conor McGrath',
          fulfilmentRef: 'member-7',
          contextRef: null,
        }),
      ],
    };

    it('lists every item in the basket, and who it was for', async () => {
      mockExecute.mockResolvedValue(basket);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(await screen.findByText('What this paid for')).toBeInTheDocument();
      expect(screen.getByText('Intermediate — Kildare Hunt Pony Club')).toBeInTheDocument();
      // The description says what was bought; the name says whose it is. Two
      // children in one class would otherwise be two identical rows.
      expect(screen.getByText('Áine McGrath')).toBeInTheDocument();
      expect(screen.getByText('Full Member 2026')).toBeInTheDocument();
      expect(screen.getByText('Conor McGrath')).toBeInTheDocument();
    });

    it('shows each line’s own method, so a split basket is legible', async () => {
      mockExecute.mockResolvedValue(basket);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await screen.findByText('What this paid for');
      // `stripe` and `pay-offline` are what the payment_methods table calls
      // them; untranslated they would reach the screen as those raw names.
      expect(screen.getAllByText('Card').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
    });

    it('shows each fee and its share of the handling fee', async () => {
      mockExecute.mockResolvedValue(basket);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await screen.findByText('What this paid for');
      expect(screen.getByText('€25.00')).toBeInTheDocument();
      // Twice over: the line's own share, and the footer's total of it.
      expect(screen.getAllByText('€0.62').length).toBe(2);
      expect(screen.getAllByText('€96.00').length).toBeGreaterThan(0);
    });

    it('totals the lines, so the figure at the top of the page is accounted for', async () => {
      mockExecute.mockResolvedValue(basket);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await screen.findByText('What this paid for');
      expect(screen.getByText('Subtotal')).toBeInTheDocument();
      expect(screen.getByText('€121.00')).toBeInTheDocument();
      // 121.00 + 0.62, which is the payment's own amount.
      expect(screen.getByText('€121.62')).toBeInTheDocument();
    });

    it('opens the entry itself, on its own event', async () => {
      mockExecute.mockResolvedValue(basket);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      fireEvent.click(await screen.findByText('View entry'));
      // This used to land on the entrant list for the whole event — two
      // hundred names, having asked about one.
      expect(mockNavigate).toHaveBeenCalledWith('/events/evt-9/entries/entry-1');
    });

    it('opens a membership on the member’s own record', async () => {
      mockExecute.mockResolvedValue(basket);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      fireEvent.click(await screen.findByText('View member'));
      expect(mockNavigate).toHaveBeenCalledWith('/members/member-7');
    });

    it('says a line has produced nothing yet rather than offering a dead link', async () => {
      // An unpaid offline membership is not created until the money arrives.
      mockExecute.mockResolvedValue({
        ...mockPayment,
        lines: [line({ itemType: 'membership', fulfilled: false, fulfilmentRef: null })],
      });
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(await screen.findByText('Not created yet')).toBeInTheDocument();
      expect(screen.queryByText('View member')).not.toBeInTheDocument();
    });

    it('shows a refunded item as refunded, and says its entry went with it', async () => {
      /*
       * The item's own state. A basket can hold one line refunded and three
       * not, and the payment's status says nothing about which is which.
       */
      mockExecute.mockResolvedValue({
        ...mockPayment,
        lines: [line({ refundedAmount: 2562, entryStatus: 'removed' })],
      });
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await screen.findByText('What this paid for');
      expect(screen.getByText('Refunded')).toBeInTheDocument();
      expect(screen.getByText('Entry withdrawn')).toBeInTheDocument();
    });

    it('shows how much went back on a part-refunded item', async () => {
      // "Partly refunded" with no figure leaves the club to work it out from
      // two other columns.
      mockExecute.mockResolvedValue({ ...mockPayment, lines: [line({ refundedAmount: 1000 })] });
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(await screen.findByText('Partially refunded')).toBeInTheDocument();
      expect(screen.getByText('€10.00 refunded')).toBeInTheDocument();
    });

    it('shows a line that has not been refunded at its own status', async () => {
      mockExecute.mockResolvedValue({ ...mockPayment, lines: [line()] });
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await screen.findByText('What this paid for');
      // "Paid" appears on the payment too, so this counts rather than expecting
      // one: what matters is that the line does not read as refunded.
      expect(screen.getAllByText('Paid').length).toBeGreaterThan(1);
      expect(screen.queryByText('Refunded')).not.toBeInTheDocument();
      expect(screen.queryByText('Entry withdrawn')).not.toBeInTheDocument();
    });

    it('shows an unpaid line as unpaid, not as refunded', async () => {
      // A basket part-owed offline: the line's own status still stands.
      mockExecute.mockResolvedValue({
        ...mockPayment,
        lines: [line({ status: 'pending', fulfilled: false })],
      });
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await screen.findByText('What this paid for');
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('says so when a payment carries no lines at all', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(
        await screen.findByText('No items are recorded against this payment.')
      ).toBeInTheDocument();
    });

    it('survives a payment saved before lines were returned', async () => {
      // `lines` absent, not empty: an older cached response.
      const { lines: _lines, ...withoutLines } = mockPayment;
      mockExecute.mockResolvedValue(withoutLines);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(
        await screen.findByText('No items are recorded against this payment.')
      ).toBeInTheDocument();
    });
  });
  /**
   * What happened to the payment afterwards.
   *
   * Two histories, from two places. Refunds are rows in their own table — a
   * payment can be refunded twice — and the settlement history comes from the
   * audit trail, because the payment row holds only the current state: an undo
   * nulls `offline_received_at` and `offline_received_by`, so a receipt that was
   * reversed leaves no trace on the payment at all.
   */
  describe('refunds against a payment', () => {
    const refund = (over: Record<string, unknown> = {}) => ({
      id: 'refund-1',
      refundAmount: 20,
      refundReason: 'Withdrew before the closing date',
      refundStatus: 'completed',
      refundDate: '2026-08-30T09:00:00Z',
      requestedAt: '2026-08-30T09:00:00Z',
      requestedByName: 'Aoife Byrne',
      requestedByEmail: 'admin@kildarehunt.test',
      refundScope: 'amount',
      items: [],
      ...over,
    });

    const open = (payment: unknown) => {
      mockExecute.mockResolvedValue(payment);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();
    };

    it('shows who asked for each refund, when, why and how much', async () => {
      open({ ...mockPayment, refunds: [refund()] });

      expect(await screen.findByText('Refunds')).toBeInTheDocument();
      expect(screen.getByText('Aoife Byrne')).toBeInTheDocument();
      expect(screen.getByText('Withdrew before the closing date')).toBeInTheDocument();
      expect(screen.getByText('€20.00')).toBeInTheDocument();
    });

    it('says how much of the payment has gone back', async () => {
      /*
       * A part refund leaves the payment `paid` — there is no partial status —
       * so this line is the only thing on the screen that says so.
       */
      open({ ...mockPayment, refunds: [refund()] });

      expect(await screen.findByText('€20.00 of €50.00 has been refunded.')).toBeInTheDocument();
    });

    it('totals several refunds rather than showing only the last', async () => {
      open({
        ...mockPayment,
        refunds: [refund(), refund({ id: 'refund-2', refundAmount: 5 })],
      });

      expect(await screen.findByText('€25.00 of €50.00 has been refunded.')).toBeInTheDocument();
    });

    it('marks a refund asked for but not yet sent', async () => {
      open({ ...mockPayment, refunds: [refund({ refundStatus: 'pending' })] });

      expect(await screen.findByText('Awaiting transfer')).toBeInTheDocument();
    });

    it('can be refunded again while it is only partly refunded', async () => {
      // Refunding one item at a time is the point; a payment part-way through
      // must still offer the button.
      open({ ...mockPayment, paymentStatus: 'partially_refunded', refunds: [refund()] });

      expect(await screen.findByRole('button', { name: /request refund/i })).toBeInTheDocument();
    });

    it('offers nothing more once the whole payment has gone back', async () => {
      open({ ...mockPayment, paymentStatus: 'refunded', refunds: [refund({ refundAmount: 50 })] });

      await screen.findByText('Refunds');
      expect(screen.queryByRole('button', { name: /request refund/i })).not.toBeInTheDocument();
    });

    it('says how each refund was arrived at, and which items it covered', async () => {
      open({
        ...mockPayment,
        refunds: [
          refund({
            refundScope: 'items',
            items: [
              { lineId: 'line-1', description: 'Intermediate — Spring League', amount: 2562 },
            ],
          }),
        ],
      });

      expect(await screen.findByText(/Items: Intermediate — Spring League/)).toBeInTheDocument();
    });

    it('shows no refund card at all on a payment with none', async () => {
      // An empty card on every payment ever taken is noise.
      open(mockPayment);

      await screen.findByText('What this paid for');
      expect(screen.queryByText('Refunds')).not.toBeInTheDocument();
    });

    it('asks the endpoint for the whole of what is left', async () => {
      /*
       * The refund used to send `{ reason }` alone and was refused with
       * "refundAmount and requestedBy are required" — the button did nothing.
       * What is left, not the whole payment, or a second refund would be refused
       * for exceeding the refundable amount.
       */
      open({ ...mockPayment, refunds: [refund()] });

      fireEvent.click(await screen.findByRole('button', { name: /request refund/i }));
      fireEvent.change(screen.getByLabelText(/Refund Reason/), {
        target: { value: 'Cancelled' },
      });
      fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }));

      /*
       * `full` means what is *left*, which the server works out — the dialog no
       * longer sends a figure at all. What it must not do is send the payment's
       * own amount: a second refund of an already part-refunded payment would
       * be refused for exceeding what is refundable.
       */
      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/payments/1/refund',
            data: expect.objectContaining({ scope: 'full', refundReason: 'Cancelled' }),
          })
        )
      );
      expect(mockExecute).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ refundAmount: 50 }) })
      );
    });
  });

  describe('how an offline settlement got where it is', () => {
    const settled = (over: Record<string, unknown> = {}) => ({
      occurredAt: '2026-09-01T11:53:55Z',
      kind: 'received',
      actorName: 'Deirdre Ó Ceallaigh',
      actorEmail: 'admin@meathhunt.test',
      itemsCreated: 2,
      itemsFailed: 0,
      ...over,
    });

    const open = (payment: unknown) => {
      mockExecute.mockResolvedValue(payment);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();
    };

    it('shows who recorded the money as received, and when', async () => {
      open({ ...mockPayment, settlement: [settled()] });

      expect(await screen.findByText('Offline settlement')).toBeInTheDocument();
      expect(screen.getByText('Deirdre Ó Ceallaigh')).toBeInTheDocument();
      expect(screen.getByText('Marked received')).toBeInTheDocument();
      expect(screen.getByText('2 items created')).toBeInTheDocument();
    });

    it('shows an undo, which the payment row cannot remember', async () => {
      open({
        ...mockPayment,
        settlement: [settled(), settled({ kind: 'undone', itemsCreated: null, itemsFailed: null })],
      });

      expect(await screen.findByText('Receipt undone')).toBeInTheDocument();
    });

    it('marks a settlement that half worked', async () => {
      // The member has paid and has not got everything; the alert that said so
      // is long closed, and this is what remembers.
      open({ ...mockPayment, settlement: [settled({ itemsCreated: 1, itemsFailed: 1 })] });

      expect(await screen.findByText('1 could not be created')).toBeInTheDocument();
    });

    it('shows a dash where the counts were never captured', async () => {
      // Null, not zero: zero would claim the receipt released nothing.
      open({ ...mockPayment, settlement: [settled({ itemsCreated: null, itemsFailed: null })] });

      await screen.findByText('Offline settlement');
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('shows no settlement card on a payment nobody settled by hand', async () => {
      open(mockPayment);

      await screen.findByText('What this paid for');
      expect(screen.queryByText('Offline settlement')).not.toBeInTheDocument();
    });
  });

  /**
   * Settling an offline payment from the payment itself.
   *
   * Somebody who has opened a payment to look at it should not have to go and
   * find it again in the Offline Payments list to record the cheque.
   */
  describe('recording an offline payment as received', () => {
    const awaiting = {
      ...mockPayment,
      paymentStatus: 'awaiting_offline',
      paymentMethod: 'offline',
      offlineReceivedAt: null,
    };

    const open = (payment: unknown) => {
      mockExecute.mockResolvedValue(payment);
      window.history.pushState({}, '', '/payments/1');
      renderComponent();
    };

    it('offers to record a payment the club is still owed', async () => {
      open(awaiting);

      expect(await screen.findByRole('button', { name: 'Mark received' })).toBeInTheDocument();
    });

    it('offers nothing of the sort on a card payment', async () => {
      open(mockPayment);

      await screen.findByText('What this paid for');
      expect(screen.queryByRole('button', { name: 'Mark received' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    });

    it('records it, and says what the money released', async () => {
      open(awaiting);

      fireEvent.click(await screen.findByRole('button', { name: 'Mark received' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/organisation/payments/1/received',
            throwOnError: true,
          })
        )
      );
      expect(await screen.findByText(/now has everything they paid for/)).toBeInTheDocument();
    });

    it('offers to undo a receipt that has been recorded', async () => {
      open({ ...mockPayment, offlineReceivedAt: '2026-09-01T14:50:35.000Z' });

      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/orgadmin/organisation/payments/1/received',
            throwOnError: true,
          })
        )
      );
    });

    it('shows a refusal in the server’s own words rather than claiming success', async () => {
      /*
       * The bug this pair of buttons was written around: `execute` answers
       * `null` on a refusal, so the screen said "Undone" while the server was
       * answering 400.
       */
      mockExecute
        .mockResolvedValueOnce({ ...mockPayment, offlineReceivedAt: '2026-09-01T14:50:35.000Z' })
        .mockRejectedValueOnce(new Error('Recording this payment created memberships.'));
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

      expect(
        await screen.findByText('Recording this payment created memberships.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/back to awaiting settlement/)).not.toBeInTheDocument();
    });

    it('reloads the payment afterwards, so the page shows where it now stands', async () => {
      open(awaiting);

      fireEvent.click(await screen.findByRole('button', { name: 'Mark received' }));

      await waitFor(() =>
        expect(
          mockExecute.mock.calls.filter(
            (call) => call[0].method === 'GET' && call[0].url === '/api/orgadmin/payments/1'
          ).length
        ).toBeGreaterThan(1)
      );
    });
  });
});


/**
 * Where each kind of line leads.
 *
 * Entries and registrations have no page of their own in the org-admin app, so
 * they go to the list that holds them — an entry through the event named in the
 * line's `contextRef`, which is the only place the basket recorded it.
 */
describe('lineDestination', () => {
  const of = (over: Record<string, unknown>) => lineDestination(line(over) as never);

  it('sends an entry to the entry, on its own event', () => {
    expect(of({})).toBe('/events/evt-9/entries/entry-1');
  });

  it('refuses an entry whose basket did not record the event', () => {
    // `/events//entries` would be a route to nowhere.
    expect(of({ contextRef: null })).toBeNull();
    expect(of({ contextRef: {} })).toBeNull();
  });

  it('sends a membership, an order and a booking to their records', () => {
    expect(of({ itemType: 'membership', fulfilmentRef: 'member-7' })).toBe('/members/member-7');
    expect(of({ itemType: 'merchandise', fulfilmentRef: 'order-3' })).toBe(
      '/merchandise/orders/order-3'
    );
    expect(of({ itemType: 'booking', fulfilmentRef: 'booking-2' })).toBe(
      '/calendar/bookings/booking-2'
    );
    /*
     * The registration itself. Both of these led to the list that holds them —
     * a club that clicked one line of a payment arrived at the whole database —
     * and both `registrations/:id` and `calendar/bookings/:id` had existed all
     * along.
     */
    expect(of({ itemType: 'registration', fulfilmentRef: 'reg-4' })).toBe('/registrations/reg-4');
  });

  it('leads nowhere while a line has produced no record', () => {
    for (const itemType of ['event_entry', 'membership', 'registration', 'booking', 'merchandise']) {
      expect(of({ itemType, fulfilmentRef: null })).toBeNull();
    }
  });

  it('leads nowhere for a kind of line this app has no page for', () => {
    expect(of({ itemType: 'donation', fulfilmentRef: 'don-1' })).toBeNull();
  });
});

/**
 * Where one item of a basket stands.
 *
 * Derived from what has gone back against the line rather than stored: the
 * money is the fact, and a second column recording the same thing would be free
 * to disagree with it.
 */
describe('itemStatus', () => {
  const at = (over: Record<string, unknown>) => itemStatus(line(over) as never);

  it('is refunded once the fee and its share of the handling fee have gone back', () => {
    // That is what the member paid for the line, and what refunding it returns.
    expect(at({ fee: 2500, handlingFee: 62, refundedAmount: 2562 })).toBe('refunded');
  });

  it('is partly refunded while some of it stands', () => {
    expect(at({ fee: 2500, handlingFee: 62, refundedAmount: 1000 })).toBe('partially_refunded');
  });

  it('does not call a line refunded while its fee share is outstanding', () => {
    // €25.00 back on a €25.62 line is a part refund, not a whole one.
    expect(at({ fee: 2500, handlingFee: 62, refundedAmount: 2500 })).toBe('partially_refunded');
  });

  it('is the line’s own status where nothing has gone back', () => {
    expect(at({ refundedAmount: 0, status: 'paid' })).toBe('paid');
    expect(at({ refundedAmount: 0, status: 'pending' })).toBe('pending');
  });

  it('does not call a free line refunded', () => {
    // Nothing was paid and nothing has gone back; zero is not "all of it".
    expect(at({ fee: 0, handlingFee: 0, refundedAmount: 0, status: 'paid' })).toBe('paid');
  });
});
