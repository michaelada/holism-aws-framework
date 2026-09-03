import { PaymentService } from '../payment.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

// Mock exceljs
/*
 * `exceljs` is deliberately **not** mocked.
 *
 * A stand-in class was what hid the defect these suites exist to catch: the
 * real module exports a namespace with `Workbook` on it and no default at all,
 * so `new ExcelJS()` threw "is not a constructor" and every Excel export in the
 * application produced a file the operating system refuses to open — while
 * every one of these tests passed against a class of its own making.
 *
 * The library is fast and pure; running it for real is what lets an assertion
 * on the bytes mean something.
 */

describe('PaymentService', () => {
  let service: PaymentService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new PaymentService();
    jest.clearAllMocks();
  });

  describe('getPaymentsByOrganisation', () => {
    it('should return all payments for an organisation', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          organisation_id: 'org-1',
          user_id: 'user-1',
          payment_type: 'event_entry',
          context_id: 'event-1',
          amount: '50.00',
          currency: 'EUR',
          payment_method: 'card',
          payment_status: 'paid',
          payment_provider: 'stripe',
          provider_transaction_id: 'txn_123',
          payment_date: new Date('2024-01-15'),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          user_name: 'John Doe',
          user_email: 'john@example.com',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockPayments } as any);

      const result = await service.getPaymentsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('payment-1');
      expect(result[0].amount).toBe(50.0);
      expect(result[0].paymentStatus).toBe('paid');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.organisation_id = $1'),
        ['org-1']
      );
    });

    /*
     * The query has always joined `organization_users` for the payer's name and
     * email, and the mapper then dropped both — so every row reached the
     * org-admin payments screen with no name on it.
     */
    it('carries the payer through from the join', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'payment-1',
            amount: '50.00',
            payment_status: 'paid',
            payment_type: 'cart',
            metadata: {},
            user_name: 'Áine McGrath',
            user_email: 'aine@example.test',
          },
        ],
      } as any);

      const [payment] = await service.getPaymentsByOrganisation('org-1');

      expect(payment.userName).toBe('Áine McGrath');
      expect(payment.userEmail).toBe('aine@example.test');
    });

    /*
     * `user_name` is `first_name || ' ' || last_name`, which Postgres makes
     * null when either part is — and a payment by a deleted user has no row to
     * join at all. Neither must reach a screen as "null" or as a stray space.
     */
    it('reports no payer rather than a blank one', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'p1', amount: '1.00', metadata: {}, user_name: null, user_email: null },
          { id: 'p2', amount: '1.00', metadata: {}, user_name: '   ', user_email: null },
        ],
      } as any);

      const [noRow, blank] = await service.getPaymentsByOrganisation('org-1');

      expect(noRow.userName).toBeNull();
      expect(blank.userName).toBeNull();
    });

    it('should filter payments by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentsByOrganisation('org-1', {
        paymentStatus: ['paid', 'pending'],
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.payment_status = ANY($2)'),
        expect.arrayContaining(['org-1', ['paid', 'pending']])
      );
    });

    it('should filter payments by payment method', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentsByOrganisation('org-1', {
        paymentMethod: ['card', 'offline'],
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.payment_method = ANY($2)'),
        expect.arrayContaining(['org-1', ['card', 'offline']])
      );
    });

    it('should filter payments by payment type', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentsByOrganisation('org-1', {
        paymentType: ['event_entry', 'membership'],
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.payment_type = ANY($2)'),
        expect.arrayContaining(['org-1', ['event_entry', 'membership']])
      );
    });

    it('should filter payments by date range', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.getPaymentsByOrganisation('org-1', {
        startDate,
        endDate,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.payment_date >='),
        expect.arrayContaining(['org-1', startDate, endDate])
      );
    });

    it('should filter payments by search term', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentsByOrganisation('org-1', {
        searchTerm: 'John',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['org-1', '%John%'])
      );
    });

    it('should apply multiple filters together', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentsByOrganisation('org-1', {
        paymentStatus: ['paid'],
        paymentMethod: ['card'],
        startDate: new Date('2024-01-01'),
        searchTerm: 'John',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.payment_status = ANY'),
        expect.arrayContaining(['org-1', ['paid'], ['card']])
      );
    });
  });

  /**
   * What a payment was for.
   *
   * Everything taken through checkout carries `payment_type = 'cart'`, which is
   * true and useless: the list's Type column read "Basket" on every row. The
   * lines know what was bought, so the list carries their distinct types.
   */
  describe('what is in the basket', () => {
    it('carries the distinct item types of a payment’s lines', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          {
            ...paidPayment(),
            payment_type: 'cart',
            item_types: ['event_entry', 'membership', 'merchandise'],
          },
        ],
      } as any);

      const [payment] = await service.getPaymentsByOrganisation('org-1');

      expect(payment.itemTypes).toEqual(['event_entry', 'membership', 'merchandise']);
    });

    it('reads them from the lines, ordered, so a basket does not shuffle', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentsByOrganisation('org-1');

      const [sql] = mockDb.query.mock.calls[0];
      expect(sql).toContain('SELECT DISTINCT pt.item_type');
      expect(sql).toContain('ORDER BY pt.item_type');
    });

    it('is empty rather than absent on a payment with no lines', async () => {
      // The screen falls back to `paymentType` there; an undefined array would
      // be a crash on the way to doing so.
      mockDb.query.mockResolvedValue({ rows: [{ ...paidPayment(), item_types: null }] } as any);

      const [payment] = await service.getPaymentsByOrganisation('org-1');

      expect(payment.itemTypes).toEqual([]);
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by ID', async () => {
      const mockPayment = {
        id: 'payment-1',
        organisation_id: 'org-1',
        user_id: 'user-1',
        payment_type: 'event_entry',
        context_id: 'event-1',
        amount: '50.00',
        currency: 'EUR',
        payment_method: 'card',
        payment_status: 'paid',
        payment_provider: 'stripe',
        provider_transaction_id: 'txn_123',
        payment_date: new Date('2024-01-15'),
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
        user_name: 'John Doe',
        user_email: 'john@example.com',
      };

      mockDb.query.mockResolvedValue({ rows: [mockPayment] } as any);

      const result = await service.getPaymentById('payment-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('payment-1');
      expect(result?.amount).toBe(50.0);
      expect(result?.paymentStatus).toBe('paid');
    });

    it('should return null when payment not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getPaymentById('nonexistent');

      expect(result).toBeNull();
    });
  });

  /**
   * The basket behind a payment.
   *
   * The org-admin payment screen shows one row per thing bought — who it was
   * for, how it was settled, and its share of the handling fee — so a club can
   * answer "what is this EUR 185 for?" without going to the database.
   */
  describe('getPaymentLines', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'line-1',
      item_type: 'event_entry',
      description: 'Intermediate',
      fee: 2500,
      handling_fee: 62,
      status: 'paid',
      fulfilled_at: new Date('2024-01-15'),
      fulfilment_ref: 'entry-1',
      context_ref: { eventId: 'evt-9' },
      payment_method: 'stripe',
      subject_name: 'Aine McGrath',
      ...over,
    });

    it('returns a line per thing the basket held', async () => {
      mockDb.query.mockResolvedValue({
        rows: [row(), row({ id: 'line-2', item_type: 'membership', subject_name: 'Conor McGrath' })],
      } as any);

      const lines = await service.getPaymentLines('payment-1', 'org-1');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        id: 'line-1',
        itemType: 'event_entry',
        fee: 2500,
        handlingFee: 62,
        paymentMethod: 'stripe',
        fulfilmentRef: 'entry-1',
        subjectName: 'Aine McGrath',
        contextRef: { eventId: 'evt-9' },
      });
      expect(lines[1].subjectName).toBe('Conor McGrath');
    });

    it('scopes the lines to the organisation that owns the payment', async () => {
      // Without the join on payments.organisation_id, one club could read
      // another club's basket by guessing a payment id.
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getPaymentLines('payment-1', 'org-1');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(sql).toContain('p.organisation_id = $2');
      expect(params).toEqual(['payment-1', 'org-1']);
    });

    it('reports a line as fulfilled only once it has produced a record', async () => {
      mockDb.query.mockResolvedValue({
        rows: [row({ fulfilled_at: null, fulfilment_ref: null })],
      } as any);

      const [line] = await service.getPaymentLines('payment-1', 'org-1');

      expect(line.fulfilled).toBe(false);
      expect(line.fulfilmentRef).toBeNull();
    });

    it('leaves the name null rather than empty when nothing was joined', async () => {
      /*
       * CONCAT_WS returns an empty string, not null, when every argument is
       * null; the query nulls each branch itself so the first one cannot always
       * win. Whatever survives that, an absent name stays null here rather than
       * reaching a screen as a blank or as the string "null".
       */
      mockDb.query.mockResolvedValue({
        rows: [row({ subject_name: null, payment_method: null, context_ref: null })],
      } as any);

      const [line] = await service.getPaymentLines('payment-1', 'org-1');

      expect(line.subjectName).toBeNull();
      expect(line.paymentMethod).toBeNull();
      expect(line.contextRef).toBeNull();
    });

    it('reads a missing fee as zero rather than as undefined', async () => {
      mockDb.query.mockResolvedValue({ rows: [row({ fee: null, handling_fee: null })] } as any);

      const [line] = await service.getPaymentLines('payment-1', 'org-1');

      expect(line.fee).toBe(0);
      expect(line.handlingFee).toBe(0);
    });

    it('returns nothing for a payment raised with no lines', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.getPaymentLines('payment-1', 'org-1')).resolves.toEqual([]);
    });

    it('propagates a database failure rather than reporting an empty basket', async () => {
      mockDb.query.mockRejectedValue(new Error('connection lost'));

      await expect(service.getPaymentLines('payment-1', 'org-1')).rejects.toThrow('connection lost');
    });
  });

  /**
   * The refunds behind a payment, and across a club.
   *
   * A refund is the record of money going back, and its whole purpose is
   * accountability — so it has to name the administrator who asked for it
   * rather than showing the uuid the column holds.
   */
  describe('reading refunds', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'refund-1',
      payment_id: 'payment-1',
      organisation_id: 'org-1',
      refund_amount: '25.00',
      refund_reason: 'Withdrew before the closing date',
      refund_status: 'pending',
      refund_provider: null,
      provider_refund_id: null,
      refund_date: null,
      requested_by: 'orguser-9',
      requested_at: new Date('2026-08-30T09:00:00Z'),
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
      requested_by_name: 'Aoife Byrne',
      requested_by_email: 'admin@kildarehunt.test',
      ...over,
    });

    it('names who asked for each refund on a payment', async () => {
      mockDb.query.mockResolvedValue({ rows: [row()] } as any);

      const [refund] = await service.getRefundsForPayment('payment-1', 'org-1');

      expect(refund).toMatchObject({
        id: 'refund-1',
        refundAmount: 25,
        refundReason: 'Withdrew before the closing date',
        refundStatus: 'pending',
        requestedByName: 'Aoife Byrne',
        requestedByEmail: 'admin@kildarehunt.test',
      });
    });

    it('scopes a payment’s refunds to the organisation asking', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getRefundsForPayment('payment-1', 'org-1');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(sql).toContain('r.organisation_id = $2');
      expect(params).toEqual(['payment-1', 'org-1']);
    });

    it('leaves the requester unnamed rather than blank when their row is gone', async () => {
      // An administrator can be removed; the refund they authorised remains.
      mockDb.query.mockResolvedValue({
        rows: [row({ requested_by_name: null, requested_by_email: null })],
      } as any);

      const [refund] = await service.getRefundsForPayment('payment-1', 'org-1');

      expect(refund.requestedByName).toBeNull();
      expect(refund.requestedByEmail).toBeNull();
    });

    it('carries enough of the payment for a refund to be listed on its own', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          row({
            payment_amount: '50.00',
            payment_status: 'refunded',
            payment_method: 'card',
            payment_date: new Date('2026-08-01T10:00:00Z'),
            payer_name: 'Fionn Doyle',
            payer_email: 'fionn@example.com',
          }),
        ],
      } as any);

      const [refund] = await service.listRefunds('org-1');

      expect(refund).toMatchObject({
        refundAmount: 25,
        paymentAmount: 50,
        paymentStatus: 'refunded',
        payerName: 'Fionn Doyle',
        requestedByName: 'Aoife Byrne',
      });
    });

    it('lists only this club’s refunds', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.listRefunds('org-1');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(sql).toContain('r.organisation_id = $1');
      expect(params).toEqual(['org-1']);
    });
  });

  /**
   * How an offline settlement got where it is.
   *
   * Read from the audit trail rather than the payment row, because an undo
   * nulls `offline_received_at` and `offline_received_by` — a payment marked
   * received in error and put back is indistinguishable from one nobody ever
   * touched.
   */
  describe('getSettlementHistory', () => {
    const event = (over: Record<string, unknown> = {}) => ({
      occurred_at: new Date('2026-09-01T11:53:55Z'),
      action: 'offline-payment.recorded',
      outcome: 'success',
      actor_display: 'Deirdre Ó Ceallaigh',
      actor_email: 'admin@meathhunt.test',
      changes: { created: { itemsCreated: 2, itemsFailed: 0 } },
      ...over,
    });

    it('reports each act with who did it and what it released', async () => {
      mockDb.query.mockResolvedValue({ rows: [event()] } as any);

      const [settled] = await service.getSettlementHistory('payment-1', 'org-1');

      expect(settled).toMatchObject({
        kind: 'received',
        actorName: 'Deirdre Ó Ceallaigh',
        actorEmail: 'admin@meathhunt.test',
        itemsCreated: 2,
        itemsFailed: 0,
      });
    });

    it('tells an undo apart from the receipt it reversed', async () => {
      mockDb.query.mockResolvedValue({
        rows: [event(), event({ action: 'offline-payment.receipt-undone', changes: null })],
      } as any);

      const history = await service.getSettlementHistory('payment-1', 'org-1');

      expect(history.map((entry) => entry.kind)).toEqual(['received', 'undone']);
    });

    it('leaves the counts null on an event recorded before they were captured', async () => {
      // Null, not zero: zero would claim the receipt released nothing.
      mockDb.query.mockResolvedValue({ rows: [event({ changes: { created: {} } })] } as any);

      const [settled] = await service.getSettlementHistory('payment-1', 'org-1');

      expect(settled.itemsCreated).toBeNull();
      expect(settled.itemsFailed).toBeNull();
    });

    it('reads the trail oldest first, scoped to the club', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getSettlementHistory('payment-1', 'org-1');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(sql).toContain('organisation_id = $2');
      expect(sql).toContain('ORDER BY occurred_at ASC');
      expect(params).toEqual(['payment-1', 'org-1']);
    });

    it('returns nothing for a payment that was never settled by hand', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.getSettlementHistory('payment-1', 'org-1')).resolves.toEqual([]);
    });
  });

  /** A payment that can be refunded, as `SELECT *` returns it. */
  const paidPayment = (over: Record<string, unknown> = {}) => ({
    id: 'payment-1',
    organisation_id: 'org-1',
    user_id: 'user-1',
    payment_type: 'event_entry',
    context_id: 'event-1',
    amount: '50.00',
    currency: 'EUR',
    payment_method: 'card',
    payment_status: 'paid',
    payment_provider: 'stripe',
    provider_transaction_id: 'txn_123',
    payment_date: new Date('2024-01-15'),
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  });

  const refundRow = (over: Record<string, unknown> = {}) => ({
    id: 'refund-1',
    payment_id: 'payment-1',
    organisation_id: 'org-1',
    refund_amount: '25.00',
    refund_reason: 'Customer request',
    refund_status: 'pending',
    refund_provider: null,
    provider_refund_id: null,
    refund_date: null,
    requested_by: 'orguser-9',
    requested_at: new Date('2026-08-30T09:00:00Z'),
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  });

  /**
   * Refunding a payment, or part of one.
   *
   * Four ways to arrive at an amount, and the difference is not cosmetic: it
   * decides what the payment becomes. The amount is computed by the service for
   * every scope but `amount` — a client able to name both a scope and a figure
   * could refund the whole of a payment while calling it one line of it.
   */
  describe('requestRefund', () => {
    /** `getPaymentById`, then the refunds already taken, then the lines. */
    const answering = (
      payment: Record<string, unknown>,
      alreadyRefunded: string,
      lines: Array<Record<string, unknown>>
    ) => {
      /*
       * `mockReset`, not the outer `clearAllMocks`: that clears recorded calls
       * and leaves queued `mockResolvedValueOnce` results in place, so a test
       * that throws part-way through hands its leftovers to the next one — and
       * the next test's *payment* row is somebody else's answer.
       */
      mockDb.query.mockReset();
      mockDb.query
        .mockResolvedValueOnce({ rows: [payment] } as any)
        .mockResolvedValueOnce({ rows: [{ total_refunded: alreadyRefunded }] } as any)
        .mockResolvedValueOnce({ rows: lines } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'orguser-9' }] } as any) // who is asking
        .mockResolvedValue({ rows: [refundRow()], rowCount: 1 } as any); // insert, links, status
    };

    const line = (over: Record<string, unknown> = {}) => ({
      id: 'line-1',
      item_type: 'event_entry',
      fee: 2500,
      handling_fee: 62,
      fulfilment_ref: 'entry-1',
      refunded: 0,
      ...over,
    });

    /** Every call made, as `[sql, params]`, for asserting on what was written. */
    const calls = () => mockDb.query.mock.calls.map((call) => [String(call[0]), call[1]] as const);
    const call = (fragment: string) => calls().find(([sql]) => sql.includes(fragment));

    it('refunds the whole of what is left and settles the payment', async () => {
      answering(paidPayment(), '0', [line()]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'full',
      });

      expect(call('INSERT INTO refunds')![1]).toContain(50);
      expect(outcome.paymentStatus).toBe('refunded');
      expect(call('SET payment_status')![1]).toContain('refunded');
    });

    it('refunds what is left of a part-refunded payment, not the whole of it', async () => {
      // Otherwise "refund the rest" would be refused for exceeding what is
      // refundable, which is the opposite of what it says.
      answering(paidPayment({ payment_status: 'partially_refunded' }), '20.00', [line()]);

      await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'full',
      });

      expect(call('INSERT INTO refunds')![1]).toContain(30);
    });

    it('keeps back the handling fee, and still settles the payment', async () => {
      /*
       * The fee is what the card cost the club, added on top of the price. A
       * club returning everything it took for the goods has refunded the
       * order — leaving it "partially" refunded for ever would be misleading.
       */
      answering(paidPayment({ handling_fee: 108 }), '0', [line()]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'lessHandlingFee',
      });

      expect(call('INSERT INTO refunds')![1]).toContain(48.92);
      expect(outcome.paymentStatus).toBe('refunded');
    });

    it('refuses to keep back a handling fee that was never added on', async () => {
      // An item whose price absorbs its fee has none to keep back, so this
      // would silently be a full refund under another name.
      answering(paidPayment({ handling_fee: 0 }), '0', [line()]);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'lessHandlingFee',
        })
      ).rejects.toThrow(/handling fee/i);
    });

    it('refunds a named item at what was paid for it, fee share included', async () => {
      // The member paid the line's own fee plus its share of the handling fee,
      // and is owed both back with it.
      answering(paidPayment(), '0', [line(), line({ id: 'line-2', fee: 9600, handling_fee: 0 })]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'items',
        lineIds: ['line-1'],
      });

      expect(call('INSERT INTO refunds')![1]).toContain(25.62);
      expect(outcome.paymentStatus).toBe('partially_refunded');
      expect(call('INSERT INTO refund_transactions')![1]).toEqual([
        'refund-1',
        'line-1',
        2562,
      ]);
    });

    it('settles the payment once the items refunded cover it', async () => {
      /*
       * A club refunding one entry at a time ends at `refunded`, not at a
       * payment that is "partially" refunded for ever.
       */
      answering(paidPayment({ amount: '50.00' }), '24.38', [
        line({ id: 'line-2', fee: 2500, handling_fee: 62, refunded: 0 }),
      ]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'items',
        lineIds: ['line-2'],
      });

      expect(outcome.paymentStatus).toBe('refunded');
    });

    it('refuses an item that has already been refunded', async () => {
      answering(paidPayment(), '25.62', [line({ refunded: 2562 })]);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'items',
          lineIds: ['line-1'],
        })
      ).rejects.toThrow(/already been refunded/i);
    });

    it('refuses an item that belongs to another payment', async () => {
      answering(paidPayment(), '0', [line()]);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'items',
          lineIds: ['line-from-elsewhere'],
        })
      ).rejects.toThrow(/not part of this payment/i);
    });

    it('refunds an arbitrary amount, leaving the payment partly refunded', async () => {
      answering(paidPayment(), '0', [line()]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'amount',
        refundAmount: 10,
      });

      expect(call('INSERT INTO refunds')![1]).toContain(10);
      expect(outcome.paymentStatus).toBe('partially_refunded');
    });

    it('refuses an amount beyond what is left', async () => {
      answering(paidPayment(), '40.00', [line()]);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'amount',
          refundAmount: 15,
        })
      ).rejects.toThrow(/exceeds remaining/i);
    });

    it('refuses a second refund once nothing is left', async () => {
      answering(paidPayment(), '50.00', [line()]);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'amount',
          refundAmount: 5,
        })
      ).rejects.toThrow(/already been refunded in full/i);
    });

    it('refuses a refund on a payment that never took any money', async () => {
      mockDb.query.mockReset();
      mockDb.query.mockResolvedValue({ rows: [paidPayment({ payment_status: 'pending' })] } as any);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'full',
        })
      ).rejects.toThrow(/only refund paid payments/i);
    });

    it('reports another club’s payment as not found', async () => {
      // Not "belongs to another organisation": that confirms it exists.
      mockDb.query.mockReset();
      mockDb.query.mockResolvedValue({ rows: [paidPayment({ organisation_id: 'org-2' })] } as any);

      await expect(
        service.requestRefund({
          paymentId: 'payment-1',
          organisationId: 'org-1',
          requestedBy: 'kc-1',
          scope: 'full',
        })
      ).rejects.toThrow(/not found/i);
    });

    it('records the org-admin row for the caller, not their Keycloak id', async () => {
      /*
       * `refunds.requested_by` references `organization_users(id)` and the
       * caller holds a Keycloak id — the same mismatch that made recording an
       * offline receipt fail against a foreign key.
       */
      answering(paidPayment(), '0', [line()]);

      await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-admin-1',
        scope: 'full',
      });

      const insert = call('INSERT INTO refunds')!;
      expect(insert[1]).toContain('orguser-9');
      expect(insert[1]).not.toContain('kc-admin-1');
    });

    it('treats an amount with no scope as an amount, not as everything', async () => {
      /*
       * The legacy shape: `{ refundAmount }` and nothing else. Defaulting to
       * `full` there would ignore the figure and refund the whole payment —
       * the one mistake here that moves more money than was asked for.
       */
      answering(paidPayment(), '0', [line()]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        refundAmount: 10,
      });

      expect(call('INSERT INTO refunds')![1]).toContain(10);
      expect(outcome.paymentStatus).toBe('partially_refunded');
    });

    it('records how the amount was arrived at', async () => {
      answering(paidPayment(), '0', [line()]);

      await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'amount',
        refundAmount: 10,
      });

      expect(call('INSERT INTO refunds')![1]).toContain('amount');
    });
  });

  /**
   * Withdrawing what a refund paid for.
   *
   * Asked rather than assumed: a club that refunds an entry as a goodwill
   * gesture may well still expect the rider on the day.
   */
  describe('withdrawing entries with a refund', () => {
    const line = (over: Record<string, unknown> = {}) => ({
      id: 'line-1',
      item_type: 'event_entry',
      fee: 2500,
      handling_fee: 62,
      fulfilment_ref: 'entry-1',
      refunded: 0,
      ...over,
    });

    const answering = (lines: Array<Record<string, unknown>>) => {
      mockDb.query.mockReset();
      return mockDb.query
        .mockResolvedValueOnce({ rows: [paidPayment()] } as any)
        .mockResolvedValueOnce({ rows: [{ total_refunded: '0' }] } as any)
        .mockResolvedValueOnce({ rows: lines } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'orguser-9' }] } as any)
        .mockResolvedValue({ rows: [refundRow()], rowCount: 1 } as any);
    };

    const withdrawal = () =>
      mockDb.query.mock.calls.find((c) => String(c[0]).includes("entry_status = 'removed'"));

    it('withdraws nothing unless it was asked for', async () => {
      answering([line()]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'full',
      });

      expect(withdrawal()).toBeUndefined();
      expect(outcome.entriesRemoved).toBe(0);
    });

    it('withdraws only the entries the refund named', async () => {
      answering([line(), line({ id: 'line-2', fulfilment_ref: 'entry-2' })]);

      await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'items',
        lineIds: ['line-1'],
        removeEntries: true,
      });

      expect(withdrawal()![1]).toEqual([['line-1'], 'orguser-9', null]);
    });

    it('withdraws every entry on the payment for a full refund', async () => {
      answering([line(), line({ id: 'line-2', fulfilment_ref: 'entry-2' })]);

      await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'full',
        removeEntries: true,
      });

      expect(withdrawal()![1]![0]).toEqual(['line-1', 'line-2']);
    });

    it('marks them removed rather than deleting them', async () => {
      // The entry happened, was paid for and was refunded. All three are worth
      // keeping; it simply comes off the entrant list.
      answering([line()]);

      await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'full',
        removeEntries: true,
      });

      const [sql] = withdrawal()!;
      expect(String(sql)).toContain('UPDATE event_entries');
      expect(String(sql)).not.toContain('DELETE');
      expect(String(sql)).toContain("pt.item_type = 'event_entry'");
    });

    it('withdraws nothing for an arbitrary amount that leaves the payment short', async () => {
      /*
       * €20 off a basket of four names no item. Choosing entries to withdraw
       * would be inventing a decision the club did not make — so the option is
       * not offered for that scope, and is refused here even if it is sent.
       */
      answering([line(), line({ id: 'line-2', fulfilment_ref: 'entry-2' })]);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'amount',
        refundAmount: 10,
        removeEntries: true,
      });

      expect(withdrawal()).toBeUndefined();
      expect(outcome.entriesRemoved).toBe(0);
    });

    it('reports how many were withdrawn', async () => {
      answering([line()]);
      mockDb.query.mockResolvedValue({ rows: [refundRow()], rowCount: 2 } as any);

      const outcome = await service.requestRefund({
        paymentId: 'payment-1',
        organisationId: 'org-1',
        requestedBy: 'kc-1',
        scope: 'full',
        removeEntries: true,
      });

      expect(outcome.entriesRemoved).toBe(2);
    });
  });

  describe('exportPayments', () => {
    it('should generate Excel file with payment data', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          organisation_id: 'org-1',
          user_id: 'user-1',
          payment_type: 'event_entry',
          context_id: 'event-1',
          amount: '50.00',
          currency: 'EUR',
          payment_method: 'card',
          payment_status: 'paid',
          payment_provider: 'stripe',
          provider_transaction_id: 'txn_123',
          payment_date: new Date('2024-01-15'),
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          user_name: 'John Doe',
          user_email: 'john@example.com',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockPayments } as any);

      const result = await service.exportPayments('org-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.organisation_id = $1'),
        ['org-1']
      );
    });

    it('should export payments with filters applied', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.exportPayments('org-1', {
        paymentStatus: ['paid'],
        startDate: new Date('2024-01-01'),
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.payment_status = ANY'),
        expect.arrayContaining(['org-1', ['paid']])
      );
    });

    it('should handle empty payment list', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.exportPayments('org-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

});
