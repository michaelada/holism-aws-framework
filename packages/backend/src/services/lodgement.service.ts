import Stripe from 'stripe';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { AppError, NotFoundError } from '../middleware/errors';
import { stripeConfigFromEnv, StripePlatformConfig } from './payment-providers/stripe.provider';
import { stripeConnectService } from './stripe-connect.service';

/**
 * Lodgements — money that actually reached the club's bank account.
 *
 * Not to be confused with what the club *charged*, which is what `payments`
 * records and what the screen this replaced was summing. The two differ by
 * fees, refunds, Stripe's payout schedule and the simple fact that a card
 * payment on Monday is not in anyone's bank on Monday. A club reconciling its
 * accounts needs the second number, and until now had no way to see it.
 *
 * ## The shape of the money
 *
 * The platform takes card payments as **Connect destination charges**: the
 * charge is created on the platform account, `transfer_data.destination` sends
 * the club's share on to its connected account, and `application_fee_amount`
 * stays with the platform. So a lodgement is a **payout on the club's connected
 * account**, and its composition is the balance transactions Stripe assigned to
 * that payout.
 *
 * Stripe's own processing fee is charged to the account that created the charge
 * — the platform, since we do not set `on_behalf_of` — so it does **not** reduce
 * the club's lodgement. Presenting it as a deduction from the club's money would
 * be a lie about who paid what. What the club receives is the gross minus the
 * application fee.
 *
 * Nothing here recomputes Stripe's arithmetic. The amounts come from Stripe's
 * own `amount` / `fee` / `net` on each balance transaction, so if the commercial
 * arrangement changes the display follows without an edit here.
 *
 * See docs/LODGEMENTS.md.
 */

/** A payout: money on its way to, or already in, the club's bank. */
export interface Lodgement {
  id: string;
  /** When it lands (or landed) in the bank, not when it was created. */
  arrivalDate: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';
  /** Populated only for a failure, and the reason a club opens this screen. */
  failureMessage: string | null;
  /** e.g. "AIB ····6789". Null when Stripe does not say. */
  destination: string | null;
}

export interface LodgementPage {
  lodgements: Lodgement[];
  /** Cursor for the next page, or null at the end. Stripe gives no total. */
  nextCursor: string | null;
  /**
   * Collected but not yet scheduled for a payout. Not a lodgement — it has no
   * date — so it is reported separately and must never be rendered as a row.
   */
  notYetPaidOut: { amount: number; currency: string } | null;
}

/** One item in the basket that produced a payment. */
export interface LodgementBasketItem {
  description: string;
  itemType: string;
  quantity: number | null;
  /** Minor units. */
  fee: number;
  handlingFee: number;
}

/**
 * One line of a lodgement.
 *
 * A line is not always a payment. Refunds and Stripe's own adjustments land in
 * a payout too, and leaving them out would produce a list that does not add up
 * to the total — which reads as a bug in the total rather than as an omission.
 */
export interface LodgementLine {
  /** Stripe's balance transaction id. Unique within the payout. */
  id: string;
  type: 'payment' | 'refund' | 'adjustment' | 'other';
  /** What Stripe calls it, for anything we do not model. */
  description: string | null;
  createdAt: string;
  /** What reached this lodgement, in minor units. Negative for a refund. */
  net: number;
  currency: string;

  /** Everything below is null when the line has no matching payment here. */
  paymentId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  /** What the member was actually charged — larger than `net` by the fee. */
  grossCharged: number | null;
  /** The platform's cut, which is the gap between the two. */
  applicationFee: number | null;
  basket: LodgementBasketItem[];
}

export interface LodgementDetail extends Lodgement {
  lines: LodgementLine[];
  /** Σ of what members were charged across resolvable lines. */
  totalCharged: number;
  /** Σ application fees across resolvable lines. */
  totalFees: number;
  /** Σ of refund lines, as a negative number. */
  totalRefunded: number;
}

export class LodgementsUnavailable extends AppError {
  constructor(provider: string) {
    super(501, 'LODGEMENTS_UNAVAILABLE', `Lodgements are not available for ${provider} yet`);
  }
}

export interface ListOptions {
  limit?: number;
  cursor?: string | null;
}

/**
 * Deliberately two methods and no more.
 *
 * `stripe-connect.service` makes the same judgement about onboarding: inventing
 * a generic shape around one real implementation is a guess dressed as a design.
 * When Helix Pay is integrated, whatever it actually offers can widen this —
 * guessing now would only produce an interface that fits neither provider.
 */
export interface LodgementSource {
  listLodgements(organisationId: string, options: ListOptions): Promise<LodgementPage>;
  getLodgement(organisationId: string, lodgementId: string): Promise<LodgementDetail>;
}

const STRIPE_API_VERSION = '2025-10-29.clover';

/** Stripe caps list pages at 100. */
const STRIPE_PAGE_LIMIT = 100;

/**
 * How far either side of a payout to look for the transfers that fed it.
 *
 * The transfers in a payout are contemporaneous with it by construction, so a
 * window keeps the search to a page or two even for a club with years of
 * history. Generous enough to absorb a delayed payout schedule.
 */
const TRANSFER_SEARCH_WINDOW_DAYS = 45;

const DAY = 24 * 60 * 60;

export class StripeLodgementSource implements LodgementSource {
  private readonly client: Stripe | null;

  constructor(config: StripePlatformConfig = stripeConfigFromEnv(), client?: Stripe) {
    if (client) {
      this.client = client;
    } else if (config.secretKey) {
      this.client = new Stripe(config.secretKey, {
        apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      });
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * The club's connected account, or a refusal that names the actual problem.
   *
   * A club that has never connected has no lodgements *and never could*, which
   * is a different thing from having none yet — the screen says so rather than
   * showing an empty table that reads as "no money".
   */
  private async connectedAccount(organisationId: string): Promise<string> {
    const state = await stripeConnectService.getState(organisationId);
    if (!state.accountId) {
      throw new NotFoundError('This organisation is not connected to Stripe');
    }
    return state.accountId;
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
    }
    return this.client;
  }

  /**
   * Turn Stripe's own failures into something an administrator can act on.
   *
   * Without this they arrive as a bare 500 and the screen says only that it
   * could not load — which is true and useless. The case that matters is a
   * connected account the platform can no longer reach: revoked access, or a
   * key from a different Stripe account than the one the club was connected
   * with. Both are configuration problems with a real remedy, and neither is a
   * fault in the request.
   *
   * Found in development, where the stored account belonged to a different
   * platform than the local key — which is exactly the shape of the production
   * failure when a club disconnects.
   */
  private async withStripe<T>(organisationId: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const stripeError = error as { type?: string; code?: string; statusCode?: number; message?: string };
      if (!stripeError?.type?.startsWith?.('Stripe')) throw error;

      logger.error('Stripe refused a lodgements request', {
        organisationId,
        type: stripeError.type,
        code: stripeError.code,
      });

      if (stripeError.statusCode === 403 || stripeError.code === 'account_invalid') {
        throw new AppError(
          502,
          'STRIPE_ACCESS_REVOKED',
          "This organisation's Stripe connection is no longer valid. Reconnect it in Payment Settings."
        );
      }

      if (stripeError.statusCode === 404) {
        throw new NotFoundError('No such lodgement');
      }

      throw new AppError(502, 'STRIPE_UNAVAILABLE', 'Stripe could not be reached just now.');
    }
  }

  async listLodgements(organisationId: string, options: ListOptions): Promise<LodgementPage> {
    const client = this.requireClient();
    const stripeAccount = await this.connectedAccount(organisationId);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), STRIPE_PAGE_LIMIT);

    const payouts = await this.withStripe(organisationId, () =>
      client.payouts.list(
        {
          limit,
          ...(options.cursor ? { starting_after: options.cursor } : {}),
          expand: ['data.destination'],
        },
        { stripeAccount }
      )
    );

    /*
     * Best effort. A club that can list payouts can normally read its own
     * balance, but a permissions or account-state failure here must not take
     * down the list of lodgements — the balance is a supporting figure.
     */
    let notYetPaidOut: LodgementPage['notYetPaidOut'] = null;
    try {
      const balance = await client.balance.retrieve({}, { stripeAccount });
      const pending = [...balance.pending, ...balance.available];
      if (pending.length > 0) {
        notYetPaidOut = {
          amount: pending.reduce((sum, entry) => sum + entry.amount, 0),
          currency: pending[0].currency.toUpperCase(),
        };
      }
    } catch (error) {
      logger.warn('Could not read the connected account balance', {
        organisationId,
        error: (error as Error).message,
      });
    }

    return {
      lodgements: payouts.data.map((payout) => this.toLodgement(payout)),
      nextCursor: payouts.has_more ? payouts.data[payouts.data.length - 1].id : null,
      notYetPaidOut,
    };
  }

  async getLodgement(organisationId: string, lodgementId: string): Promise<LodgementDetail> {
    const client = this.requireClient();
    const stripeAccount = await this.connectedAccount(organisationId);

    const payout = await this.withStripe(organisationId, () =>
      client.payouts.retrieve(lodgementId, { expand: ['destination'] }, { stripeAccount })
    );

    /*
     * Every balance transaction in the payout, not the first hundred. A busy
     * club's weekly payout runs to several pages, and a partial list would
     * silently fail to reconcile against the payout total.
     */
    const entries: Stripe.BalanceTransaction[] = [];
    let cursor: string | undefined;
    do {
      const page: Stripe.ApiList<Stripe.BalanceTransaction> = await this.withStripe(
        organisationId,
        () =>
          client.balanceTransactions.list(
            {
              payout: lodgementId,
              limit: STRIPE_PAGE_LIMIT,
              ...(cursor ? { starting_after: cursor } : {}),
              expand: ['data.source'],
            },
            { stripeAccount }
          )
      );
      entries.push(...page.data);
      cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
    } while (cursor);

    const resolved = await this.resolvePayments(organisationId, stripeAccount, entries);
    const lines = await this.toLines(organisationId, entries, resolved);

    return {
      ...this.toLodgement(payout),
      lines,
      totalCharged: sum(lines.map((l) => l.grossCharged ?? 0)),
      totalFees: sum(lines.map((l) => l.applicationFee ?? 0)),
      totalRefunded: sum(lines.filter((l) => l.type === 'refund').map((l) => l.net)),
    };
  }

  private toLodgement(payout: Stripe.Payout): Lodgement {
    const destination = payout.destination;
    let label: string | null = null;
    if (destination && typeof destination !== 'string' && 'last4' in destination) {
      const bank = destination as Stripe.BankAccount;
      label = [bank.bank_name, bank.last4 ? `····${bank.last4}` : null].filter(Boolean).join(' ');
    }

    return {
      id: payout.id,
      // `arrival_date`, not `created`: what a club wants is the day the money is
      // in the account, which is the date on their bank statement.
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
      amount: payout.amount,
      currency: payout.currency.toUpperCase(),
      status: payout.status as Lodgement['status'],
      failureMessage: payout.failure_message ?? null,
      destination: label || null,
    };
  }

  /**
   * Match Stripe's club-side charges to our payments.
   *
   * The awkward heart of this. A destination charge produces two charge objects
   * — `ch_…` on the platform, under the PaymentIntent we store, and `py_…` on
   * the club's account, which is the one that appears in the payout. Stripe does
   * not copy PaymentIntent metadata onto the club-side charge, so there is
   * nothing on it that names our payment.
   *
   * Once learned, the mapping is written to `provider_destination_payment_id`
   * and never looked up again. What follows only runs for payments taken before
   * that column existed, or created directly in Stripe.
   *
   * The chain is `py_… → source_transfer tr_… → source_transaction ch_… →
   * payment_intent pi_…`. Walked one payment at a time that is three API calls
   * each. Instead the transfers to this club are listed in bulk — one call per
   * hundred — and matched, bounded to a window around the payout because the
   * transfers that fed it are contemporaneous with it by construction.
   *
   * Returns club-side charge id → our payment id.
   */
  private async resolvePayments(
    organisationId: string,
    stripeAccount: string,
    entries: Stripe.BalanceTransaction[]
  ): Promise<Map<string, string>> {
    const chargeIds = entries
      .map((entry) => sourceId(entry.source))
      .filter((id): id is string => Boolean(id));

    if (chargeIds.length === 0) return new Map();

    const known = await db.query(
      `SELECT id, provider_destination_payment_id
         FROM payments
        WHERE organisation_id = $1
          AND provider_destination_payment_id = ANY($2::text[])`,
      [organisationId, chargeIds]
    );

    const resolved = new Map<string, string>(
      known.rows.map((row) => [row.provider_destination_payment_id, row.id])
    );

    const unresolved = chargeIds.filter((id) => !resolved.has(id));
    if (unresolved.length === 0) return resolved;

    logger.info('Resolving lodgement payments not yet linked', {
      organisationId,
      count: unresolved.length,
    });

    try {
      const learned = await this.walkTransfers(stripeAccount, entries, unresolved);
      if (learned.size === 0) return resolved;

      const byIntent = await db.query(
        `SELECT id, provider_transaction_id
           FROM payments
          WHERE organisation_id = $1
            AND provider_transaction_id = ANY($2::text[])`,
        [organisationId, [...new Set(learned.values())]]
      );

      const paymentByIntent = new Map<string, string>(
        byIntent.rows.map((row) => [row.provider_transaction_id, row.id])
      );

      for (const [destinationCharge, intentId] of learned) {
        const paymentId = paymentByIntent.get(intentId);
        if (!paymentId) continue;

        resolved.set(destinationCharge, paymentId);

        /*
         * Write the answer back so this whole walk never happens for this
         * payment again. Not awaited as a batch and not fatal if it fails: a
         * failed cache write must not fail the page, it only makes the next
         * view do this work again.
         */
        await db
          .query(
            `UPDATE payments
                SET provider_destination_payment_id = $2, updated_at = NOW()
              WHERE id = $1 AND provider_destination_payment_id IS NULL`,
            [paymentId, destinationCharge]
          )
          .catch((error) =>
            logger.warn('Could not cache the destination payment id', {
              paymentId,
              error: (error as Error).message,
            })
          );
      }
    } catch (error) {
      /*
       * A resolution failure degrades the screen, it does not break it. The
       * unresolved lines render as "not in this system", which still reconciles
       * against the payout total.
       */
      logger.warn('Could not resolve every lodgement payment', {
        organisationId,
        error: (error as Error).message,
      });
    }

    return resolved;
  }

  /** Club-side charge id → platform PaymentIntent id, for the ids given. */
  private async walkTransfers(
    stripeAccount: string,
    entries: Stripe.BalanceTransaction[],
    unresolved: string[]
  ): Promise<Map<string, string>> {
    const client = this.requireClient();
    const wanted = new Set(unresolved);

    /*
     * The club-side charge names its transfer, and the balance transactions are
     * already expanded, so this needs no further calls.
     */
    const transferByCharge = new Map<string, string>();
    for (const entry of entries) {
      const source = entry.source;
      if (!source || typeof source === 'string') continue;
      const chargeId = source.id;
      if (!wanted.has(chargeId)) continue;

      const sourceTransfer = (source as Stripe.Charge).source_transfer;
      const transferId = typeof sourceTransfer === 'string' ? sourceTransfer : sourceTransfer?.id;
      if (transferId) transferByCharge.set(chargeId, transferId);
    }

    if (transferByCharge.size === 0) return new Map();

    const timestamps = entries.map((entry) => entry.created);
    const window = TRANSFER_SEARCH_WINDOW_DAYS * DAY;
    const gte = Math.min(...timestamps) - window;
    const lte = Math.max(...timestamps) + window;

    const needed = new Set(transferByCharge.values());
    const intentByTransfer = new Map<string, string>();

    let cursor: string | undefined;
    // Bounded: without a ceiling a club with a long history and one unresolvable
    // transfer would page until Stripe rate-limited us.
    for (let page = 0; page < 10 && needed.size > 0; page++) {
      const transfers: Stripe.ApiList<Stripe.Transfer> = await client.transfers.list({
        destination: stripeAccount,
        limit: STRIPE_PAGE_LIMIT,
        created: { gte, lte },
        ...(cursor ? { starting_after: cursor } : {}),
        expand: ['data.source_transaction'],
      });

      for (const transfer of transfers.data) {
        if (!needed.has(transfer.id)) continue;
        const charge = transfer.source_transaction;
        if (!charge || typeof charge === 'string') continue;

        const intent = (charge as Stripe.Charge).payment_intent;
        const intentId = typeof intent === 'string' ? intent : intent?.id;
        if (intentId) {
          intentByTransfer.set(transfer.id, intentId);
          needed.delete(transfer.id);
        }
      }

      if (!transfers.has_more) break;
      cursor = transfers.data[transfers.data.length - 1]?.id;
      if (!cursor) break;
    }

    const result = new Map<string, string>();
    for (const [chargeId, transferId] of transferByCharge) {
      const intentId = intentByTransfer.get(transferId);
      if (intentId) result.set(chargeId, intentId);
    }
    return result;
  }

  /** Stripe's entries, joined to what we know about the orders behind them. */
  private async toLines(
    organisationId: string,
    entries: Stripe.BalanceTransaction[],
    resolved: Map<string, string>
  ): Promise<LodgementLine[]> {
    const paymentIds = [...new Set(resolved.values())];

    const details = paymentIds.length
      ? await db.query(
          `SELECT p.id, p.amount, p.currency, p.application_fee_amount, p.handling_fee,
                  ou.first_name, ou.last_name, ou.email,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'description', pt.description,
                        'itemType', pt.item_type,
                        'quantity', pt.quantity,
                        'fee', pt.fee,
                        'handlingFee', pt.handling_fee
                      ) ORDER BY pt.created_at
                    ) FILTER (WHERE pt.id IS NOT NULL),
                    '[]'
                  ) AS basket
             FROM payments p
             LEFT JOIN organization_users ou ON ou.id = p.user_id
             LEFT JOIN payment_transactions pt ON pt.payment_id = p.id
            WHERE p.organisation_id = $1 AND p.id = ANY($2::uuid[])
            GROUP BY p.id, ou.first_name, ou.last_name, ou.email`,
          [organisationId, paymentIds]
        )
      : { rows: [] as any[] };

    const byPayment = new Map<string, any>(details.rows.map((row) => [row.id, row]));

    return entries
      // The payout itself appears in its own balance transactions as a negative
      // entry. Listing it as a line would double-count the whole lodgement.
      .filter((entry) => entry.type !== 'payout')
      .map((entry) => {
        const chargeId = sourceId(entry.source);
        const paymentId = chargeId ? resolved.get(chargeId) ?? null : null;
        const detail = paymentId ? byPayment.get(paymentId) : null;

        return {
          id: entry.id,
          type: lineType(entry.type),
          description: entry.description ?? null,
          createdAt: new Date(entry.created * 1000).toISOString(),
          net: entry.net,
          currency: entry.currency.toUpperCase(),
          paymentId,
          memberName: detail
            ? [detail.first_name, detail.last_name].filter(Boolean).join(' ') || detail.email
            : null,
          memberEmail: detail?.email ?? null,
          /*
           * From our own record, not from Stripe's entry: the club-side entry is
           * already net of the application fee, so it cannot say what the member
           * was charged. That figure is the point of the whole screen.
           */
          grossCharged: detail ? Math.round(Number(detail.amount) * 100) : null,
          applicationFee: detail ? Number(detail.application_fee_amount ?? 0) : null,
          basket: detail ? (detail.basket as LodgementBasketItem[]) : [],
        };
      });
  }
}

/** Helix Pay has no lodgement reporting yet; saying so beats an empty table. */
export class HelixPayLodgementSource implements LodgementSource {
  async listLodgements(): Promise<LodgementPage> {
    throw new LodgementsUnavailable('Helix Pay');
  }

  async getLodgement(): Promise<LodgementDetail> {
    throw new LodgementsUnavailable('Helix Pay');
  }
}

function sourceId(source: Stripe.BalanceTransaction['source']): string | null {
  if (!source) return null;
  return typeof source === 'string' ? source : source.id;
}

function lineType(type: string): LodgementLine['type'] {
  if (type === 'payment' || type === 'charge') return 'payment';
  if (type === 'refund' || type === 'payment_refund') return 'refund';
  if (type === 'adjustment' || type === 'transfer') return 'adjustment';
  return 'other';
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export const lodgementService = new StripeLodgementSource();
