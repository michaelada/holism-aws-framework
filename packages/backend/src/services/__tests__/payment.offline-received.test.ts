import { PaymentService } from '../payment.service';
import { db } from '../../database/pool';
import { fulfilmentService } from '../fulfilment.service';
import { NotFoundError, ValidationError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../fulfilment.service', () => ({
  fulfilmentService: { fulfilPayment: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockFulfilment = fulfilmentService as jest.Mocked<typeof fulfilmentService>;

/**
 * Recording that money paid outside the system has arrived (I1, I2).
 *
 * **This is the step that finishes an offline order**, and until it existed the
 * app made a promise it could not keep: a member paying by cheque checked out
 * into `awaiting_offline`, fulfilment deferred their membership, and their own
 * payments screen read "the club has still to record this as received" with no
 * way for the club to record it.
 *
 * The two rules that matter are that fulfilment runs on marking, and that an
 * undo is refused once anything has been created.
 */
describe('PaymentService — offline settlement', () => {
  const ORG = 'org-1';
  const PAYMENT = 'pay-1';
  const ADMIN = 'admin-1';

  const service = new PaymentService();

  const paymentRow = (over: Record<string, any> = {}) => ({
    id: PAYMENT,
    organisation_id: ORG,
    user_id: 'ou-1',
    payment_type: null,
    context_id: null,
    amount: '55.00',
    currency: 'EUR',
    payment_method: 'offline',
    payment_status: 'awaiting_offline',
    payment_date: null,
    offline_received_at: null,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    fulfilled_lines: '0',
    ...over,
  });

  /** Look-up, then update, then the re-read `getPaymentById` does. */
  const respond = (rows: any[]) => {
    let call = 0;
    mockDb.query = jest.fn().mockImplementation(() => {
      const row = rows[Math.min(call, rows.length - 1)];
      call += 1;
      return Promise.resolve({ rows: row === null ? [] : [row], rowCount: row === null ? 0 : 1 });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFulfilment.fulfilPayment.mockResolvedValue({ fulfilled: 2, failed: 0, complete: true });
  });

  describe('marking it received', () => {
    it('records the money, who recorded it, and when', async () => {
      respond([paymentRow(), paymentRow({ payment_status: 'paid' })]);

      await service.markOfflinePaymentReceived(ORG, PAYMENT, ADMIN);

      const update = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('UPDATE payments')
      );
      expect(String(update?.[0])).toContain("payment_status = 'paid'");
      expect(String(update?.[0])).toContain('offline_received_at');
      expect(update?.[1]).toEqual([PAYMENT, ORG, ADMIN]);
    });

    /**
     * The whole point. Without this the cheque arrives, the club records it,
     * and the member still has no membership.
     */
    it('runs the fulfilment that was waiting on the money', async () => {
      respond([paymentRow(), paymentRow({ payment_status: 'paid' })]);

      const result = await service.markOfflinePaymentReceived(ORG, PAYMENT, ADMIN);

      expect(mockFulfilment.fulfilPayment).toHaveBeenCalledWith(PAYMENT);
      // Returned so the screen can say what the money produced.
      expect(result.fulfilment).toEqual({ fulfilled: 2, failed: 0, complete: true });
    });

    it('keeps the payment received even when a line fails to fulfil', async () => {
      mockFulfilment.fulfilPayment.mockResolvedValue({ fulfilled: 1, failed: 1, complete: false });
      respond([paymentRow(), paymentRow({ payment_status: 'paid' })]);

      const result = await service.markOfflinePaymentReceived(ORG, PAYMENT, ADMIN);

      // The money arrived; a failing line carries its own reason, as a card
      // payment's would.
      expect(result.fulfilment.failed).toBe(1);
      expect(
        mockDb.query.mock.calls.some((call) => String(call[0]).includes("payment_status = 'paid'"))
      ).toBe(true);
    });

    /** A double click, or two administrators at once. */
    it('is idempotent — a second marking creates nothing new', async () => {
      respond([
        paymentRow({ payment_status: 'paid', offline_received_at: new Date('2026-08-01') }),
        paymentRow({ payment_status: 'paid' }),
      ]);

      await service.markOfflinePaymentReceived(ORG, PAYMENT, ADMIN);

      const update = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('UPDATE payments')
      );
      // COALESCE keeps the original time and the original administrator.
      expect(String(update?.[0])).toContain('COALESCE(offline_received_at, NOW())');
      expect(String(update?.[0])).toContain('COALESCE(offline_received_by, $3)');
    });

    /**
     * A card payment's money arrives through the provider and its status is the
     * webhook's to set; marking one received by hand would overwrite what
     * Stripe said with a guess.
     */
    it('refuses a payment that was never going to settle offline', async () => {
      respond([paymentRow({ payment_status: 'paid', offline_received_at: null })]);

      await expect(
        service.markOfflinePaymentReceived(ORG, PAYMENT, ADMIN)
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockFulfilment.fulfilPayment).not.toHaveBeenCalled();
    });

    it('refuses a payment belonging to another club', async () => {
      respond([null]);

      await expect(
        service.markOfflinePaymentReceived(ORG, PAYMENT, ADMIN)
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('undoing it', () => {
    it('puts the payment back to awaiting settlement', async () => {
      respond([
        paymentRow({ payment_status: 'paid', offline_received_at: new Date(), fulfilled_lines: '0' }),
        paymentRow(),
      ]);

      await service.undoOfflinePaymentReceived(ORG, PAYMENT);

      const update = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('UPDATE payments')
      );
      expect(String(update?.[0])).toContain("payment_status = 'awaiting_offline'");
      expect(String(update?.[0])).toContain('offline_received_at = NULL');
    });

    /**
     * The substance of the method. Flipping the status back would leave every
     * membership, order and booking in place, granted against money the club
     * never had, with nothing to say so.
     */
    it('refuses once the receipt has produced anything', async () => {
      respond([
        paymentRow({ payment_status: 'paid', offline_received_at: new Date(), fulfilled_lines: '2' }),
      ]);

      await expect(service.undoOfflinePaymentReceived(ORG, PAYMENT)).rejects.toThrow(
        /Refund it or cancel those individually/
      );
    });

    it('says so when the payment was never marked received', async () => {
      respond([paymentRow()]);

      await expect(service.undoOfflinePaymentReceived(ORG, PAYMENT)).rejects.toThrow(
        /not been recorded as received/i
      );
    });

    it('refuses a payment belonging to another club', async () => {
      respond([null]);

      await expect(service.undoOfflinePaymentReceived(ORG, PAYMENT)).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });
});
