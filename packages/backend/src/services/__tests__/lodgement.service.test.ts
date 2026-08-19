/**
 * Lodgements — what actually reached the club's bank.
 *
 * The assertions that matter here are about *money being described correctly*,
 * not about Stripe being called. Two in particular:
 *
 *  - Stripe's processing fee is paid by the platform under destination charges,
 *    so it must never be shown as a deduction from the club's lodgement.
 *  - The lines must add up to the payout total, which means refunds and
 *    adjustments have to be included and the payout's own balance transaction
 *    has to be excluded.
 *
 * See docs/LODGEMENTS.md.
 */

jest.mock('../../config/logger');

jest.mock('../../database/pool', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../../stripe-connect.service', () => ({}), { virtual: true });
jest.mock('../stripe-connect.service', () => ({
  stripeConnectService: { getState: jest.fn() },
}));

import { db } from '../../database/pool';
import { stripeConnectService } from '../stripe-connect.service';
import { StripeLodgementSource, HelixPayLodgementSource, LodgementsUnavailable } from '../lodgement.service';

const mockDb = db as jest.Mocked<typeof db>;
const mockConnect = stripeConnectService as jest.Mocked<typeof stripeConnectService>;

const ORG = 'org-1';
const ACCOUNT = 'acct_club';

/** A minimal Stripe double: only what this service actually calls. */
const stripe = {
  payouts: { list: jest.fn(), retrieve: jest.fn() },
  balance: { retrieve: jest.fn() },
  balanceTransactions: { list: jest.fn() },
  transfers: { list: jest.fn() },
};

const source = () => new StripeLodgementSource({ secretKey: 'sk_test' } as any, stripe as any);

const payout = (over: Record<string, any> = {}) => ({
  id: 'po_1',
  arrival_date: Math.floor(new Date('2026-08-14T00:00:00Z').getTime() / 1000),
  amount: 210400,
  currency: 'eur',
  status: 'paid',
  failure_message: null,
  destination: { last4: '6789', bank_name: 'AIB' },
  ...over,
});

/** A club-side charge as it appears in the payout, already expanded. */
const chargeEntry = (over: Record<string, any> = {}) => ({
  id: 'txn_1',
  type: 'payment',
  description: 'Payment',
  created: Math.floor(new Date('2026-08-11T09:00:00Z').getTime() / 1000),
  net: 17500,
  currency: 'eur',
  source: { id: 'py_1', source_transfer: 'tr_1' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.getState.mockResolvedValue({ accountId: ACCOUNT } as any);
  stripe.balance.retrieve.mockResolvedValue({ pending: [], available: [] });
});

describe('listing lodgements', () => {
  beforeEach(() => {
    stripe.payouts.list.mockResolvedValue({ data: [payout()], has_more: false });
  });

  it('reports the day the money lands, not the day the payout was made', async () => {
    // A club reconciles against a bank statement, and the statement shows the
    // arrival date.
    const [lodgement] = (await source().listLodgements(ORG, {})).lodgements;

    expect(lodgement.arrivalDate).toBe('2026-08-14T00:00:00.000Z');
    expect(lodgement.amount).toBe(210400);
    expect(lodgement.destination).toBe('AIB ····6789');
  });

  it('asks the club’s own account, never the platform’s', async () => {
    await source().listLodgements(ORG, {});

    expect(stripe.payouts.list).toHaveBeenCalledWith(expect.anything(), {
      stripeAccount: ACCOUNT,
    });
  });

  it('keeps a failed payout, with its reason', async () => {
    /*
     * The rows a club most needs. Someone opening this screen is usually asking
     * where money has got to, and a failure is the answer.
     */
    stripe.payouts.list.mockResolvedValue({
      data: [payout({ status: 'failed', failure_message: 'The bank account was rejected.' })],
      has_more: false,
    });

    const [lodgement] = (await source().listLodgements(ORG, {})).lodgements;

    expect(lodgement.status).toBe('failed');
    expect(lodgement.failureMessage).toBe('The bank account was rejected.');
  });

  it('reports money not yet paid out separately from the lodgements', async () => {
    // It has no date and has not moved. A row in the table would be a lodgement
    // that never happened.
    stripe.balance.retrieve.mockResolvedValue({
      pending: [{ amount: 41280, currency: 'eur' }],
      available: [],
    });

    const page = await source().listLodgements(ORG, {});

    expect(page.notYetPaidOut).toEqual({ amount: 41280, currency: 'EUR' });
    expect(page.lodgements).toHaveLength(1);
  });

  it('still lists the lodgements when the balance cannot be read', async () => {
    // A supporting figure must not take the page down with it.
    stripe.balance.retrieve.mockRejectedValue(new Error('permission denied'));

    const page = await source().listLodgements(ORG, {});

    expect(page.lodgements).toHaveLength(1);
    expect(page.notYetPaidOut).toBeNull();
  });

  it('refuses plainly when the club has never connected to Stripe', async () => {
    /*
     * Different from "no lodgements yet", and the screen says something
     * different: an empty table would read as "no money".
     */
    mockConnect.getState.mockResolvedValue({ accountId: null } as any);

    await expect(source().listLodgements(ORG, {})).rejects.toThrow(/not connected to Stripe/);
  });

  it('pages with a cursor and hands back the next one', async () => {
    stripe.payouts.list.mockResolvedValue({
      data: [payout({ id: 'po_9' })],
      has_more: true,
    });

    const page = await source().listLodgements(ORG, { cursor: 'po_5' });

    expect(stripe.payouts.list).toHaveBeenCalledWith(
      expect.objectContaining({ starting_after: 'po_5' }),
      expect.anything()
    );
    expect(page.nextCursor).toBe('po_9');
  });
});

describe('what made up a lodgement', () => {
  const paymentRow = {
    id: 'pay-1',
    amount: '180.00',
    currency: 'EUR',
    application_fee_amount: 500,
    handling_fee: 500,
    first_name: 'Sinéad',
    last_name: 'Gallagher',
    email: 'sinead@example.test',
    basket: [
      { description: 'Family Membership 2026', itemType: 'membership', quantity: 1, fee: 17000, handlingFee: 0 },
    ],
  };

  beforeEach(() => {
    stripe.payouts.retrieve.mockResolvedValue(payout());
    stripe.balanceTransactions.list.mockResolvedValue({
      data: [chargeEntry()],
      has_more: false,
    });
  });

  it('joins a Stripe entry to the basket behind it', async () => {
    mockDb.query = jest
      .fn()
      // the destination-payment lookup, already linked
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', provider_destination_payment_id: 'py_1' }] })
      // the payment detail
      .mockResolvedValueOnce({ rows: [paymentRow] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines).toHaveLength(1);
    expect(detail.lines[0].memberName).toBe('Sinéad Gallagher');
    expect(detail.lines[0].basket[0].description).toBe('Family Membership 2026');
  });

  it('shows both numbers: what the member paid and what reached the bank', async () => {
    /*
     * The gap between them is the platform's cut, and explaining that gap is
     * the reason this screen exists. Stripe's club-side entry is already net of
     * the fee, so it cannot supply the first figure — that comes from our own
     * record of what was charged.
     */
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', provider_destination_payment_id: 'py_1' }] })
      .mockResolvedValueOnce({ rows: [paymentRow] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines[0].grossCharged).toBe(18000);
    expect(detail.lines[0].applicationFee).toBe(500);
    expect(detail.lines[0].net).toBe(17500);
    expect(detail.totalCharged).toBe(18000);
    expect(detail.totalFees).toBe(500);
  });

  it('never subtracts Stripe’s own fee from the club’s money', async () => {
    /*
     * Under destination charges the processing fee is charged to the platform,
     * because we do not set `on_behalf_of`. Showing it as a deduction here
     * would understate what the club received and misname who paid it.
     *
     * Stripe reports a non-zero `fee` on the entry; the club's figure must
     * still be the entry's `net`, untouched.
     */
    stripe.balanceTransactions.list.mockResolvedValue({
      data: [chargeEntry({ fee: 231, net: 17500 })],
      has_more: false,
    });
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', provider_destination_payment_id: 'py_1' }] })
      .mockResolvedValueOnce({ rows: [paymentRow] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines[0].net).toBe(17500);
    expect(detail.totalCharged - detail.totalFees).toBe(17500);
  });

  it('keeps refunds, so the lines add up to the payout', async () => {
    // Drop these and the column silently stops summing to the total — which
    // reads as a broken total rather than a missing row.
    stripe.balanceTransactions.list.mockResolvedValue({
      data: [
        chargeEntry(),
        chargeEntry({ id: 'txn_2', type: 'refund', net: -6000, source: { id: 'py_2' } }),
      ],
      has_more: false,
    });
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', provider_destination_payment_id: 'py_1' }] })
      .mockResolvedValueOnce({ rows: [paymentRow] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines.map((l) => l.type)).toEqual(['payment', 'refund']);
    expect(detail.totalRefunded).toBe(-6000);
  });

  it('excludes the payout’s own entry, which would double the total', async () => {
    stripe.balanceTransactions.list.mockResolvedValue({
      data: [chargeEntry(), { ...chargeEntry({ id: 'txn_out' }), type: 'payout', net: -210400 }],
      has_more: false,
    });
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', provider_destination_payment_id: 'py_1' }] })
      .mockResolvedValueOnce({ rows: [paymentRow] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines).toHaveLength(1);
    expect(detail.lines.map((l) => l.id)).not.toContain('txn_out');
  });

  it('reads every page of entries, not just the first', async () => {
    // A busy club's weekly payout runs past 100 entries, and a partial list
    // would fail to reconcile with no indication why.
    stripe.balanceTransactions.list
      .mockResolvedValueOnce({ data: [chargeEntry({ id: 'txn_a' })], has_more: true })
      .mockResolvedValueOnce({ data: [chargeEntry({ id: 'txn_b' })], has_more: false });
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(stripe.balanceTransactions.list).toHaveBeenCalledTimes(2);
    expect(detail.lines).toHaveLength(2);
  });

  it('shows a line it cannot identify rather than dropping it', async () => {
    /*
     * Expected for payments taken before the link was recorded, and for
     * anything created directly in Stripe. A hidden row breaks the
     * reconciliation and looks like a bug in the total; an honest row explains
     * itself.
     */
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });
    stripe.transfers.list.mockResolvedValue({ data: [], has_more: false });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines).toHaveLength(1);
    expect(detail.lines[0].paymentId).toBeNull();
    expect(detail.lines[0].memberName).toBeNull();
    expect(detail.lines[0].net).toBe(17500);
  });
});

describe('linking a club-side charge to our payment', () => {
  /*
   * A destination charge produces two charge objects. The club's payout
   * contains `py_…`; we store the PaymentIntent `pi_…`. Nothing on the club-side
   * charge names our payment, so the chain
   *
   *     py_… → source_transfer tr_… → source_transaction ch_… → payment_intent
   *
   * has to be walked once — and then never again.
   */
  beforeEach(() => {
    stripe.payouts.retrieve.mockResolvedValue(payout());
    stripe.balanceTransactions.list.mockResolvedValue({
      data: [chargeEntry()],
      has_more: false,
    });
  });

  it('walks the transfer chain and caches what it learns', async () => {
    stripe.transfers.list.mockResolvedValue({
      data: [{ id: 'tr_1', source_transaction: { id: 'ch_1', payment_intent: 'pi_1' } }],
      has_more: false,
    });

    const updates: any[][] = [];
    mockDb.query = jest.fn().mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('provider_destination_payment_id = ANY')) return { rows: [] };
      if (sql.includes('provider_transaction_id = ANY'))
        return { rows: [{ id: 'pay-1', provider_transaction_id: 'pi_1' }] };
      if (sql.trim().startsWith('UPDATE')) {
        updates.push(params);
        return { rows: [] };
      }
      return { rows: [{ id: 'pay-1', amount: '180.00', application_fee_amount: 500, basket: [] }] };
    });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines[0].paymentId).toBe('pay-1');

    // Written back, so the next viewer pays nothing for this.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual(['pay-1', 'py_1']);
  });

  it('does not walk anything when the link is already stored', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', provider_destination_payment_id: 'py_1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await source().getLodgement(ORG, 'po_1');

    expect(stripe.transfers.list).not.toHaveBeenCalled();
  });

  it('degrades to unidentified lines when the walk fails', async () => {
    // Stripe being unavailable for the *optional* half must not fail the page;
    // the totals still reconcile without names on the rows.
    stripe.transfers.list.mockRejectedValue(new Error('rate limited'));
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

    const detail = await source().getLodgement(ORG, 'po_1');

    expect(detail.lines[0].paymentId).toBeNull();
    expect(detail.lines[0].net).toBe(17500);
  });

  it('bounds the transfer search instead of paging forever', async () => {
    /*
     * One transfer that can never be matched would otherwise page a long
     * history until Stripe rate-limited us.
     */
    stripe.transfers.list.mockResolvedValue({
      data: [{ id: 'tr_other', source_transaction: { id: 'ch_9', payment_intent: 'pi_9' } }],
      has_more: true,
    });
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

    await source().getLodgement(ORG, 'po_1');

    expect(stripe.transfers.list.mock.calls.length).toBeLessThanOrEqual(10);
    // Scoped to this club, and to a window around the payout.
    expect(stripe.transfers.list).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: ACCOUNT,
        created: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
      })
    );
  });
});

describe('when Stripe itself refuses', () => {
  /*
   * Found in development: the stored connected account belonged to a different
   * Stripe platform than the key, and Stripe answered `StripePermissionError`
   * / `account_invalid`. That is the same shape as a club revoking access in
   * production, and it surfaced as a bare 500 with a screen that said only
   * "could not load" — true, and useless.
   */
  const stripeError = (over: Record<string, unknown>) =>
    Object.assign(new Error('nope'), { type: 'StripePermissionError', ...over });

  it('names a revoked connection, and where to fix it', async () => {
    stripe.payouts.list.mockRejectedValue(
      stripeError({ code: 'account_invalid', statusCode: 403 })
    );

    /*
     * The wording is load-bearing: `useApi` surfaces only the message, so the
     * screen matches on "no longer valid" to offer the Payment Settings link.
     * Asserted here as well as in LodgementsPage.test.tsx.
     */
    await expect(source().listLodgements(ORG, {})).rejects.toThrow(
      /no longer valid.*Payment Settings/
    );
  });

  it('does not report a missing payout as a server fault', async () => {
    stripe.payouts.retrieve.mockRejectedValue(
      stripeError({ type: 'StripeInvalidRequestError', statusCode: 404 })
    );

    await expect(source().getLodgement(ORG, 'po_missing')).rejects.toThrow(/No such lodgement/);
  });

  it('reports an outage as an outage rather than as our own failure', async () => {
    stripe.payouts.list.mockRejectedValue(
      stripeError({ type: 'StripeConnectionError', statusCode: 500 })
    );

    await expect(source().listLodgements(ORG, {})).rejects.toThrow(/could not be reached/);
  });

  it('leaves anything that is not a Stripe error alone', async () => {
    // A bug in our own code must not be dressed up as a Stripe outage.
    stripe.payouts.list.mockRejectedValue(new TypeError('x is not a function'));

    await expect(source().listLodgements(ORG, {})).rejects.toThrow(/not a function/);
  });
});

describe('Helix Pay', () => {
  it('says lodgements are not available yet rather than showing none', async () => {
    // An empty table would read as "no money", which is a different and much
    // more alarming statement than "not supported yet".
    await expect(new HelixPayLodgementSource().listLodgements()).rejects.toBeInstanceOf(
      LodgementsUnavailable
    );
    await expect(new HelixPayLodgementSource().getLodgement()).rejects.toThrow(/Helix Pay/);
  });
});
